import type { SignalInput } from "../types";
import type {
  EntityDictionaryEntry,
  EntitySourceField,
  ExtractedEntity,
  ExtractedEntityType,
} from "./types";

export type SearchableTextChunk = {
  sourceField: EntitySourceField;
  text: string;
  normalizedText: string;
};

const MAX_RAW_DEPTH = 3;
const MAX_RAW_STRINGS = 40;

export function normalizeEntityText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+/.-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectRawStrings(value: unknown, output: string[], depth = 0) {
  if (
    depth > MAX_RAW_DEPTH ||
    output.length >= MAX_RAW_STRINGS ||
    value == null ||
    Array.isArray(value)
  ) {
    return;
  }

  if (typeof value === "string") {
    const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();
    if (normalized) output.push(normalized);
    return;
  }

  if (typeof value !== "object") return;

  for (const childValue of Object.values(value)) {
    collectRawStrings(childValue, output, depth + 1);
    if (output.length >= MAX_RAW_STRINGS) return;
  }
}

function chunk(sourceField: EntitySourceField, text?: string | null) {
  const normalized = text?.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  return {
    sourceField,
    text: normalized,
    normalizedText: normalizeEntityText(normalized),
  } satisfies SearchableTextChunk;
}

export function prepareSignalText(signal: SignalInput): SearchableTextChunk[] {
  const chunks: SearchableTextChunk[] = [];

  const titleChunk = chunk("title", signal.title);
  if (titleChunk) chunks.push(titleChunk);

  const summaryChunk = chunk("summary", signal.summary);
  if (summaryChunk) chunks.push(summaryChunk);

  const keywordsChunk = chunk("keywords", signal.keywords.join(" "));
  if (keywordsChunk) chunks.push(keywordsChunk);

  const rawStrings: string[] = [];
  collectRawStrings(signal.raw, rawStrings);
  const rawChunk = chunk("raw", rawStrings.join(" "));
  if (rawChunk) chunks.push(rawChunk);

  return chunks;
}

function phrasePattern(phrase: string) {
  const normalizedPhrase = normalizeEntityText(phrase);
  if (!normalizedPhrase) return null;

  const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "u");
}

export function findDictionaryEntities(
  chunks: SearchableTextChunk[],
  entries: EntityDictionaryEntry[],
  defaultType: ExtractedEntityType
): ExtractedEntity[] {
  const matches: ExtractedEntity[] = [];

  for (const entry of entries) {
    const phrases = [entry.canonicalName, ...entry.aliases];

    for (const phrase of phrases) {
      const pattern = phrasePattern(phrase);
      if (!pattern) continue;

      for (const textChunk of chunks) {
        if (!pattern.test(textChunk.normalizedText)) continue;

        matches.push({
          type: entry.type ?? defaultType,
          canonicalName: entry.canonicalName,
          matchedText: phrase,
          sourceField: textChunk.sourceField,
          confidence: entry.confidence ?? "exact",
          aliases: [...entry.aliases],
        });
      }
    }
  }

  return matches;
}
