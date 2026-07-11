import type { SignalInput, SignalType } from "../types";
import { getSignalIdentifiers, shareIdentifier } from "./identifier-dedupe";
import { hashUrl, normalizeTitleForDedupe, normalizeUrlForDedupe } from "./normalize";
import { calculateTitleSimilarity, titlesMatchExactlyForDedupe } from "./title-dedupe";
import { getDedupeUrl } from "./url-dedupe";

export type DuplicateMatch = {
  isDuplicate: boolean;
  confidence: "exact" | "high" | "medium" | "low" | "none";
  reason: string;
  matchedBy: "identifier" | "url" | "title" | "none";
  existingSignalId?: string;
  existingCanonicalUrl?: string;
  score?: number;
};

export type MinimalExistingSignal = {
  id?: string;
  title: string;
  canonicalUrl: string;
  raw?: unknown | null;
  signalType?: SignalType | string;
};

function noDuplicate(): DuplicateMatch {
  return {
    isDuplicate: false,
    confidence: "none",
    reason: "No deterministic duplicate match found.",
    matchedBy: "none",
  };
}

function match(
  existingSignal: MinimalExistingSignal,
  matchedBy: DuplicateMatch["matchedBy"],
  reason: string,
  confidence: DuplicateMatch["confidence"],
  score?: number
): DuplicateMatch {
  return {
    isDuplicate: true,
    confidence,
    reason,
    matchedBy,
    existingSignalId: existingSignal.id,
    existingCanonicalUrl: existingSignal.canonicalUrl,
    score,
  };
}

export function findDuplicateSignal(
  signal: SignalInput,
  existingSignals: MinimalExistingSignal[]
): DuplicateMatch {
  const signalIdentifiers = getSignalIdentifiers(signal);
  const normalizedUrl = normalizeUrlForDedupe(signal.canonicalUrl);
  const urlHash = hashUrl(signal.canonicalUrl);
  const normalizedTitle = normalizeTitleForDedupe(signal.title);

  for (const existingSignal of existingSignals) {
    if (
      signalIdentifiers.length > 0 &&
      shareIdentifier(signal, { raw: existingSignal.raw ?? null })
    ) {
      return match(
        existingSignal,
        "identifier",
        "Identifier metadata matched exactly.",
        "exact"
      );
    }
  }

  for (const existingSignal of existingSignals) {
    const existingUrl = getDedupeUrl(existingSignal.canonicalUrl);
    const existingHash = hashUrl(existingSignal.canonicalUrl);

    if (
      normalizedUrl &&
      existingUrl &&
      (normalizedUrl === existingUrl || urlHash === existingHash)
    ) {
      return match(existingSignal, "url", "Canonical URL matched after normalization.", "exact");
    }
  }

  for (const existingSignal of existingSignals) {
    if (normalizedTitle && titlesMatchExactlyForDedupe(signal.title, existingSignal.title)) {
      return match(existingSignal, "title", "Title matched exactly after normalization.", "exact", 1);
    }
  }

  for (const existingSignal of existingSignals) {
    const score = calculateTitleSimilarity(signal.title, existingSignal.title);

    if (score >= 0.92) {
      return match(
        existingSignal,
        "title",
        "Title similarity met the high-confidence threshold.",
        "high",
        score
      );
    }
  }

  return noDuplicate();
}
