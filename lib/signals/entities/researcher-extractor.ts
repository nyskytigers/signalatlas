import type { SignalInput } from "../types";
import type { ExtractedEntity } from "./types";
import { findDictionaryEntities, type SearchableTextChunk } from "./text";

const RESEARCHER_FIELDS = new Set([
  "author",
  "authors",
  "creator",
  "creators",
  "contributor",
  "contributors",
  "researcher",
  "researchers",
]);

const KNOWN_RESEARCHERS = [
  { canonicalName: "Robert Ballard", aliases: ["Bob Ballard"] },
  { canonicalName: "James Delgado", aliases: ["Jim Delgado"] },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePersonName(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function collectResearcherNames(value: unknown, names: Set<string>, depth = 0) {
  if (depth > 3 || value == null) return;

  if (typeof value === "string") {
    const normalized = normalizePersonName(value);
    if (normalized) names.add(normalized);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") {
        collectResearcherNames(item, names, depth + 1);
      } else if (isRecord(item)) {
        const name = item.name ?? item.fullName ?? item.full_name;
        if (typeof name === "string") collectResearcherNames(name, names, depth + 1);
      }
    }
    return;
  }

  if (!isRecord(value)) return;

  for (const [key, rawValue] of Object.entries(value)) {
    if (!RESEARCHER_FIELDS.has(key.toLowerCase())) continue;
    collectResearcherNames(rawValue, names, depth + 1);
  }
}

export function extractResearcherEntities(
  signal: SignalInput,
  chunks: SearchableTextChunk[]
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const names = new Set<string>();
  const signalResearcherKeys = new Set<string>();

  for (const researcher of signal.researchers) {
    const normalized = normalizePersonName(researcher);
    if (!normalized) continue;

    names.add(normalized);
    signalResearcherKeys.add(normalized.toLowerCase());
  }

  collectResearcherNames(signal.raw, names);

  for (const name of names) {
    entities.push({
      type: "researcher",
      canonicalName: name,
      matchedText: name,
      sourceField: signalResearcherKeys.has(name.toLowerCase()) ? "keywords" : "raw",
      confidence: "exact",
    });
  }

  return [
    ...entities,
    ...findDictionaryEntities(chunks, [...KNOWN_RESEARCHERS], "researcher"),
  ];
}
