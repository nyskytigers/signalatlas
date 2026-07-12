import type { SignalInput, SignalType } from "../types";
import type { SignalForUpdate } from "./types";

function mergeArrays(existing: string[] = [], incoming: string[] = []) {
  const merged = new Map<string, string>();

  for (const value of [...existing, ...incoming]) {
    const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (!merged.has(key)) merged.set(key, normalized);
  }

  return Array.from(merged.values());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeRaw(existing: unknown, incoming: unknown) {
  if (incoming == null) return existing ?? null;
  if (existing == null) return incoming;
  if (JSON.stringify(existing) === JSON.stringify(incoming)) return existing;

  if (isRecord(existing) && isRecord(incoming)) {
    return {
      existing,
      incoming,
    };
  }

  return { existing, incoming };
}

function signalTypeFor(existing: SignalForUpdate, incoming: SignalInput): SignalType {
  return incoming.signalType || (existing.signalType as SignalType);
}

export function mergeSignalForUpdate(
  existing: SignalForUpdate,
  incoming: SignalInput
): SignalInput {
  return {
    id: existing.id,
    title: incoming.title.trim() || existing.title,
    summary:
      incoming.summary && !existing.summary?.trim()
        ? incoming.summary
        : existing.summary ?? incoming.summary,
    sourceId: existing.sourceId ?? incoming.sourceId,
    sourceName: existing.sourceName ?? incoming.sourceName,
    canonicalUrl: existing.canonicalUrl,
    signalType: signalTypeFor(existing, incoming),
    publishedAt: existing.publishedAt ?? incoming.publishedAt,
    technologies: mergeArrays(existing.technologies, incoming.technologies),
    organizations: mergeArrays(existing.organizations, incoming.organizations),
    researchers: mergeArrays(existing.researchers, incoming.researchers),
    domains: mergeArrays(existing.domains, incoming.domains),
    keywords: mergeArrays(existing.keywords, incoming.keywords),
    relevanceScore: incoming.relevanceScore ?? existing.relevanceScore ?? null,
    raw: mergeRaw(existing.raw, incoming.raw),
  };
}
