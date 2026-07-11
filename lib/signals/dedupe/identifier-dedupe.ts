import type { SignalInput } from "../types";
import { normalizeIdentifier } from "./normalize";

const IDENTIFIER_FIELDS = new Map<string, string>([
  ["doi", "doi"],
  ["persistentid", "persistentId"],
  ["persistent_id", "persistentId"],
  ["externalid", "externalId"],
  ["external_id", "externalId"],
  ["globalid", "globalId"],
  ["global_id", "globalId"],
  ["datasetid", "datasetId"],
  ["dataset_id", "datasetId"],
  ["repositoryid", "repositoryId"],
  ["repository_id", "repositoryId"],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectIdentifiers(
  value: unknown,
  identifiers: Set<string>,
  depth = 0
) {
  if (depth > 3 || value == null) return;

  if (Array.isArray(value)) {
    for (const item of value) {
      collectIdentifiers(item, identifiers, depth + 1);
    }
    return;
  }

  if (!isRecord(value)) return;

  for (const [key, rawValue] of Object.entries(value)) {
    const canonicalKey = IDENTIFIER_FIELDS.get(key.toLowerCase());

    if (canonicalKey) {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      for (const item of values) {
        if (typeof item !== "string" && typeof item !== "number") continue;

        const normalized = normalizeIdentifier(String(item));
        if (normalized) identifiers.add(`${canonicalKey}:${normalized}`);
      }
    }

    if (isRecord(rawValue) || Array.isArray(rawValue)) {
      collectIdentifiers(rawValue, identifiers, depth + 1);
    }
  }
}

export function getSignalIdentifiers(signal: Pick<SignalInput, "raw">) {
  const identifiers = new Set<string>();
  collectIdentifiers(signal.raw, identifiers);
  return Array.from(identifiers).sort();
}

export function shareIdentifier(
  signal: Pick<SignalInput, "raw">,
  existingSignal: Pick<SignalInput, "raw">
) {
  const signalIdentifiers = new Set(getSignalIdentifiers(signal));
  if (signalIdentifiers.size === 0) return false;

  return getSignalIdentifiers(existingSignal).some((identifier) =>
    signalIdentifiers.has(identifier)
  );
}
