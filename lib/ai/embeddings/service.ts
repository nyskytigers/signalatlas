import { createNvidiaEmbeddingProvider } from "./providers/nvidia";
import { createPrismaEmbeddingRepository } from "./repository";
import {
  buildSignalEmbeddingText,
  embeddingVersionFor,
  hashSignalEmbeddingText,
  SIGNAL_EMBEDDING_INPUT_VERSION,
} from "./input";
import { validateEmbeddingResults } from "./validation";
import { NVIDIA_EMBEDDING_PROFILE } from "./config";
import type {
  EmbedSignalResult,
  EmbeddingProvider,
  EmbeddingRepository,
  EmbeddingVersionMetadata,
  SignalEmbeddingSource,
} from "./types";

type EmbedOptions = {
  provider?: EmbeddingProvider;
  repository?: EmbeddingRepository;
  force?: boolean;
  strict?: boolean;
};

const MAX_ERROR_CODE_LENGTH = 80;
const MAX_ERROR_MESSAGE_LENGTH = 500;

function versionFor(provider: EmbeddingProvider): EmbeddingVersionMetadata {
  return {
    provider: provider.provider,
    model: provider.model,
    providerVersion: provider.version,
    inputVersion: SIGNAL_EMBEDDING_INPUT_VERSION,
    dimensions: provider.dimensions,
    embeddingVersion: embeddingVersionFor({
      provider: provider.provider,
      model: provider.model,
      providerVersion: provider.version,
      dimensions: provider.dimensions,
    }),
  };
}

function errorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, "_")
      .slice(0, MAX_ERROR_CODE_LENGTH) || "unknown_error";
  }
  return "unknown_error";
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/([?&](?:api_?key|access_?token|token|signature|sig|credential)=)[^&#\s]+/gi, "$1[redacted]")
    .replace(/\b(api_?key|access_?token|token|authorization|password)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/(https?:\/\/)[^/@\s]+:[^/@\s]+@/gi, "$1[redacted]@")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ERROR_MESSAGE_LENGTH) || "Embedding request failed.";
}

async function embedLoadedSignal(
  signal: SignalEmbeddingSource,
  provider: EmbeddingProvider,
  repository: EmbeddingRepository,
  options: EmbedOptions
): Promise<EmbedSignalResult> {
  const version = versionFor(provider);
  const text = buildSignalEmbeddingText(signal);
  const contentHash = hashSignalEmbeddingText(text);
  const existing = await repository.findCompatibleEmbedding({
    signalId: signal.id,
    version,
  });

  if (!options.force && existing?.status === "SUCCESS" && existing.contentHash === contentHash) {
    return {
      signalId: signal.id,
      status: "SKIPPED",
      embeddingId: existing.id,
      contentHash,
      skippedReason: "unchanged",
    };
  }

  try {
    const results = await provider.embed([text], {
      inputType: NVIDIA_EMBEDDING_PROFILE.documentInputType,
    });
    const [result] = validateEmbeddingResults(results, 1, provider.dimensions);
    const record = await repository.upsertSuccess({
      signalId: signal.id,
      version,
      contentHash,
      sourceTextHash: contentHash,
      embedding: result.embedding,
      metadata: { textLength: text.length },
    });
    return {
      signalId: signal.id,
      status: "SUCCESS",
      embeddingId: record.id,
      contentHash,
    };
  } catch (error) {
    await repository.upsertFailure({
      signalId: signal.id,
      version,
      contentHash,
      sourceTextHash: contentHash,
      errorCode: errorCode(error),
      errorMessage: errorMessage(error),
    });
    if (options.strict) throw error;
    return {
      signalId: signal.id,
      status: "FAILED",
      contentHash,
      errorCode: errorCode(error),
      errorMessage: errorMessage(error),
    };
  }
}

export async function embedSignal(signalId: string, options: EmbedOptions = {}) {
  const provider = options.provider ?? createNvidiaEmbeddingProvider();
  const repository = options.repository ?? createPrismaEmbeddingRepository();
  const signal = await repository.findSignal(signalId);
  if (!signal) throw new Error(`Signal not found: ${signalId}`);
  return embedLoadedSignal(signal, provider, repository, options);
}

export async function embedSignals(signalIds: readonly string[], options: EmbedOptions = {}) {
  const results: EmbedSignalResult[] = [];
  for (const signalId of signalIds) {
    results.push(await embedSignal(signalId, options));
  }
  return results;
}

export async function embedSignalIfNeeded(signalId: string, options: EmbedOptions = {}) {
  const provider = options.provider ?? createNvidiaEmbeddingProvider();
  if (provider.dimensions <= 0 || provider.model === "disabled") {
    return {
      signalId,
      status: "DISABLED",
      errorCode: "provider_disabled",
      errorMessage: "Embedding provider is disabled.",
    } satisfies EmbedSignalResult;
  }

  try {
    return await embedSignal(signalId, { ...options, provider });
  } catch (error) {
    if (options.strict) throw error;
    return {
      signalId,
      status: errorCode(error) === "provider_disabled" ? "DISABLED" : "FAILED",
      errorCode: errorCode(error),
      errorMessage: errorMessage(error),
    } satisfies EmbedSignalResult;
  }
}

export async function backfillSignalEmbeddings(args: {
  signalIds?: readonly string[];
  limit: number;
  onlyMissing?: boolean;
  force?: boolean;
  dryRun?: boolean;
  provider?: EmbeddingProvider;
  repository?: EmbeddingRepository;
}) {
  const provider = args.provider ?? createNvidiaEmbeddingProvider();
  const repository = args.repository ?? createPrismaEmbeddingRepository();
  const version = versionFor(provider);
  const signals = await repository.findSignals({
    signalIds: args.signalIds,
    limit: args.limit,
    onlyMissing: args.onlyMissing,
    version,
  });

  if (args.dryRun) {
    return signals.map((signal) => ({
      signalId: signal.id,
      status: "SKIPPED" as const,
      skippedReason: "dry_run",
      contentHash: hashSignalEmbeddingText(buildSignalEmbeddingText(signal)),
    }));
  }

  const results: EmbedSignalResult[] = [];
  for (const signal of signals) {
    results.push(
      await embedLoadedSignal(signal, provider, repository, {
        provider,
        repository,
        force: args.force,
      })
    );
  }
  return results;
}

export function embeddingVersionMetadata(provider: EmbeddingProvider) {
  return versionFor(provider);
}
