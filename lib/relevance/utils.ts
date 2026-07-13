import { normalizeEntityText } from "../signals/entities";

export function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 100);
}

export function normalizeWhitespace(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function normalizeKey(value: string) {
  return normalizeEntityText(value);
}

export function uniqueNormalized(values: readonly string[] | null | undefined) {
  const normalized = new Map<string, string>();

  for (const value of values ?? []) {
    const clean = normalizeWhitespace(value);
    if (!clean) continue;

    const key = normalizeKey(clean);
    if (!normalized.has(key)) normalized.set(key, clean);
  }

  return Array.from(normalized.values()).sort((a, b) =>
    normalizeKey(a).localeCompare(normalizeKey(b))
  );
}

export function hasPhrase(normalizedText: string, phrase: string) {
  const normalizedPhrase = normalizeKey(phrase);
  if (!normalizedPhrase) return false;

  const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "u").test(
    normalizedText
  );
}

export function phrasesFound(normalizedText: string, phrases: readonly string[]) {
  return phrases
    .filter((phrase) => hasPhrase(normalizedText, phrase))
    .sort((a, b) => normalizeKey(a).localeCompare(normalizeKey(b)));
}

export function parseDate(value: Date | string | null | undefined) {
  if (value == null) return null;

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  return date;
}

export function daysBetween(earlier: Date, later: Date) {
  return (later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24);
}

export function numericEvidence(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function rawStringField(raw: unknown, keys: readonly string[]) {
  if (!isRecord(raw)) return null;

  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && normalizeWhitespace(value)) {
      return normalizeWhitespace(value);
    }
  }

  return null;
}

export function rawNumberField(raw: unknown, keys: readonly string[]) {
  if (!isRecord(raw)) return null;

  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return value;
    }
  }

  return null;
}
