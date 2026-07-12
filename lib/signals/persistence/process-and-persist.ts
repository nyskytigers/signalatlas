import { prisma } from "../../../db/prisma";
import type { MinimalExistingSignal } from "../dedupe";
import { processNormalizedItemAsSignal } from "../orchestration";
import { signalDataForPersistence } from "../persist-signal";
import type { NormalizedSignalItem } from "../normalize-to-signal";
import { loadDuplicateCandidates } from "./load-duplicate-candidates";
import { mergeSignalForUpdate } from "./merge-signal";
import type {
  ProcessAndPersistOptions,
  SignalDatabaseClient,
  SignalForUpdate,
  SignalPersistenceOperation,
  SignalPersistenceResult,
  SignalPersistenceStatus,
} from "./types";

export function isSignalPersistenceEnabled(
  env: Record<string, string | undefined> = process.env
) {
  return env.SIGNAL_PERSISTENCE_ENABLED === "true";
}

function intendedOperationFor(action: string): SignalPersistenceOperation {
  if (action === "create") return "create";
  if (action === "update") return "update";
  return "none";
}

function statusForAction(action: string): SignalPersistenceStatus {
  if (action === "review") return "review_required";
  if (action === "skip") return "skipped";
  return "disabled";
}

function findExistingForUpdate(
  processingExistingSignals: SignalForUpdate[],
  duplicate: MinimalExistingSignal
) {
  return processingExistingSignals.find((signal) => {
    if (duplicate.id && signal.id === duplicate.id) return true;
    return signal.canonicalUrl === duplicate.canonicalUrl;
  });
}

async function loadExistingForUpdate(
  client: SignalDatabaseClient,
  duplicate: MinimalExistingSignal,
  fallbackSignals: SignalForUpdate[]
) {
  const fallback = findExistingForUpdate(fallbackSignals, duplicate);
  if (fallback?.technologies) return fallback;

  if (!duplicate.id) return fallback ?? duplicate;

  return (
    (await client.signal.findUnique({
      where: { id: duplicate.id },
      select: {
        id: true,
        title: true,
        summary: true,
        canonicalUrl: true,
        signalType: true,
        sourceId: true,
        sourceName: true,
        publishedAt: true,
        technologies: true,
        organizations: true,
        researchers: true,
        domains: true,
        keywords: true,
        relevanceScore: true,
        raw: true,
      },
    })) ?? fallback ?? duplicate
  );
}

export async function processAndPersistNormalizedItem(
  item: NormalizedSignalItem,
  options: ProcessAndPersistOptions = {}
): Promise<SignalPersistenceResult> {
  const client = options.client ?? (prisma as unknown as SignalDatabaseClient);
  const dryRun = options.dryRun === true;
  const persistenceEnabled = isSignalPersistenceEnabled(options.env);

  if (!dryRun && !persistenceEnabled) {
    const processing = processNormalizedItemAsSignal(item, options.existingSignals ?? []);
    return {
      processing,
      status: processing.action === "review" ? "review_required" : "disabled",
      intendedOperation: "none",
    };
  }

  const initialProcessing = processNormalizedItemAsSignal(item, options.existingSignals ?? []);
  const candidates =
    options.existingSignals ??
    (await loadDuplicateCandidates(initialProcessing.signal, client));
  const processing = options.existingSignals
    ? initialProcessing
    : processNormalizedItemAsSignal(item, candidates);
  const intendedOperation = intendedOperationFor(processing.action);

  if (dryRun) {
    return {
      processing,
      status: "dry_run",
      intendedOperation,
    };
  }

  if (processing.action === "review" || processing.action === "skip") {
    return {
      processing,
      status: statusForAction(processing.action),
      intendedOperation: "none",
    };
  }

  if (processing.action === "create") {
    const persisted = await client.signal.upsert({
      where: { canonicalUrl: processing.signal.canonicalUrl },
      create: signalDataForPersistence(processing.signal),
      update: signalDataForPersistence(processing.signal),
    });

    return {
      processing,
      status: "created",
      persistedSignal: {
        id: persisted.id,
        canonicalUrl: persisted.canonicalUrl,
      },
      intendedOperation,
    };
  }

  const duplicate = {
    id: processing.duplicate.existingSignalId,
    title: "",
    canonicalUrl: processing.duplicate.existingCanonicalUrl ?? processing.signal.canonicalUrl,
    raw: null,
  };
  const existing = await loadExistingForUpdate(client, duplicate, candidates);
  const merged = mergeSignalForUpdate(existing, processing.signal);
  const persisted = await client.signal.update({
    where: existing.id ? { id: existing.id } : { canonicalUrl: existing.canonicalUrl },
    data: signalDataForPersistence(merged),
  });

  return {
    processing,
    status: "updated",
    persistedSignal: {
      id: persisted.id,
      canonicalUrl: persisted.canonicalUrl,
    },
    intendedOperation,
  };
}
