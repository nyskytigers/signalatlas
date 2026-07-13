import { createHash } from "node:crypto";
import { resolveTechnologyNames } from "../../signals";
import type { SignalEmbeddingSource } from "./types";

export const SIGNAL_EMBEDDING_INPUT_VERSION = "1.1.0";
const MAX_EMBEDDING_TEXT_LENGTH = 6000;
const MAX_FIELD_LENGTH = 2000;
const MAX_LIST_ITEMS = 50;
const MAX_LIST_VALUE_LENGTH = 240;
const MAX_KEYWORDS = 40;
const MAX_KEYWORD_LENGTH = 120;

function normalizeText(value: string | null | undefined, maxLength = MAX_FIELD_LENGTH) {
  const normalized = (value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength).trimEnd() : normalized;
}

function compareText(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function uniqueSorted(
  values: readonly string[] | null | undefined,
  options: { maxItems?: number; maxLength?: number; cleanMetadata?: boolean } = {}
) {
  const maxItems = options.maxItems ?? MAX_LIST_ITEMS;
  const maxLength = options.maxLength ?? MAX_LIST_VALUE_LENGTH;
  const unique = new Map<string, string>();
  for (const value of values ?? []) {
    let normalized = normalizeText(value, maxLength);
    if (options.cleanMetadata) {
      normalized = normalizeText(normalized.replace(/<[^>]*>/g, " "), maxLength);
      const looksLikeJson =
        (normalized.startsWith("{") && normalized.endsWith("}")) ||
        (normalized.startsWith("[") && normalized.endsWith("]"));
      if (looksLikeJson) continue;
    }
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (!unique.has(key)) unique.set(key, normalized);
  }
  return Array.from(unique.values()).sort(compareText).slice(0, maxItems);
}

function canonicalHostname(value: string | null | undefined) {
  const normalized = normalizeText(value, MAX_FIELD_LENGTH);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "") || null;
  } catch {
    return null;
  }
}

function line(label: string, value: string | readonly string[] | null | undefined) {
  const text =
    typeof value === "string" || value == null
      ? normalizeText(value ?? "", MAX_FIELD_LENGTH)
      : value.join(", ");
  return text ? `${label}: ${text}` : null;
}

export function buildSignalEmbeddingText(signal: SignalEmbeddingSource) {
  const technologies = uniqueSorted(resolveTechnologyNames(uniqueSorted(signal.technologies)));
  const keywords = uniqueSorted(signal.keywords, {
    maxItems: MAX_KEYWORDS,
    maxLength: MAX_KEYWORD_LENGTH,
    cleanMetadata: true,
  });
  const lines = [
    line("Title", signal.title),
    line("Type", signal.signalType),
    line("Summary", signal.summary),
    line("Domains", uniqueSorted(signal.domains)),
    line("Technologies", technologies),
    line("Organizations", uniqueSorted(signal.organizations)),
    line("Researchers", uniqueSorted(signal.researchers)),
    line("Projects", uniqueSorted(signal.projects)),
    line("Vessels", uniqueSorted(signal.vessels)),
    line("Expeditions", uniqueSorted(signal.expeditions)),
    line("Sites", uniqueSorted(signal.archaeologicalSites)),
    line("Keywords", keywords),
    line("Source", signal.sourceName),
    line("Host", canonicalHostname(signal.canonicalUrl)),
  ].filter((value): value is string => value != null);

  const text = lines.join("\n");
  return text.length > MAX_EMBEDDING_TEXT_LENGTH
    ? text.slice(0, MAX_EMBEDDING_TEXT_LENGTH).trimEnd()
    : text;
}

export function hashSignalEmbeddingText(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

export function embeddingVersionFor(args: {
  provider: string;
  model: string;
  providerVersion: string;
  dimensions: number;
}) {
  return [
    args.provider,
    args.model,
    args.providerVersion,
    SIGNAL_EMBEDDING_INPUT_VERSION,
    `${args.dimensions}d`,
  ].join(":");
}

export const SIGNAL_EMBEDDING_INPUT_LIMITS = {
  maxEmbeddingTextLength: MAX_EMBEDDING_TEXT_LENGTH,
  maxFieldLength: MAX_FIELD_LENGTH,
  maxListItems: MAX_LIST_ITEMS,
  maxKeywords: MAX_KEYWORDS,
  maxKeywordLength: MAX_KEYWORD_LENGTH,
} as const;
