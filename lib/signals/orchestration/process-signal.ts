import type { NormalizedSignalItem } from "../normalize-to-signal";
import { buildSignalFromNormalizedItem } from "../pipeline";
import {
  applyExtractedEntitiesToSignal,
  extractSignalEntities,
  type EntityExtractionResult,
} from "../entities";
import { findDuplicateSignal, type DuplicateMatch, type MinimalExistingSignal } from "../dedupe";
import type { SignalInput } from "../types";
import {
  SignalProcessingError,
  type SignalProcessingAction,
  type SignalProcessingMetrics,
  type SignalProcessingResult,
} from "./types";

// Official Signal processing order: normalize -> extract -> enrich -> dedupe -> decide.
// Persistence remains separate until the Signal migration is safely applied and live wiring is approved.

export function decideSignalProcessingAction(
  duplicate: DuplicateMatch
): SignalProcessingAction {
  if (!duplicate.isDuplicate) return "create";

  if (
    duplicate.confidence === "exact" &&
    (duplicate.matchedBy === "identifier" || duplicate.matchedBy === "url")
  ) {
    return "update";
  }

  if (duplicate.matchedBy === "title") return "review";

  return "create";
}

function validateNormalizedItem(item: NormalizedSignalItem) {
  if (typeof item !== "object" || item == null) {
    throw new SignalProcessingError(
      "INVALID_NORMALIZED_ITEM",
      "Normalized item must be an object."
    );
  }

  if (typeof item.title !== "string" || !item.title.trim()) {
    throw new SignalProcessingError(
      "MISSING_TITLE",
      "Normalized item must include a non-empty title."
    );
  }
}

function normalizeOrThrow(item: NormalizedSignalItem) {
  try {
    return buildSignalFromNormalizedItem(item);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.includes("canonicalUrl")
      ? "MISSING_CANONICAL_URL"
      : "NORMALIZATION_FAILED";

    throw new SignalProcessingError(code, message);
  }
}

function countAdded(before: string[], after: string[]) {
  const beforeKeys = new Set(before.map((value) => value.toLowerCase()));
  return after.filter((value) => !beforeKeys.has(value.toLowerCase())).length;
}

function buildEntityReason(before: SignalInput, after: SignalInput) {
  const technologyCount = countAdded(before.technologies, after.technologies);
  const organizationCount = countAdded(before.organizations, after.organizations);
  const researcherCount = countAdded(before.researchers, after.researchers);

  return `Entity enrichment added ${technologyCount} technologies, ${organizationCount} organizations, and ${researcherCount} researchers.`;
}

function duplicateReason(duplicate: DuplicateMatch) {
  if (!duplicate.isDuplicate) return "No duplicate candidate matched.";
  if (duplicate.matchedBy === "identifier") return "Exact identifier match found.";
  if (duplicate.matchedBy === "url") return "Canonical URL matched an existing signal.";
  if (duplicate.matchedBy === "title" && duplicate.confidence === "exact") {
    return "Normalized title matched exactly.";
  }
  if (duplicate.matchedBy === "title" && duplicate.confidence === "high") {
    return "Title similarity exceeded 0.92.";
  }

  return duplicate.reason;
}

function buildMetrics(
  entities: EntityExtractionResult,
  duplicate: DuplicateMatch
): SignalProcessingMetrics {
  return {
    technologyCount: entities.technologies.length,
    organizationCount:
      entities.organizations.length + entities.labs.length + entities.institutions.length,
    researcherCount: entities.researchers.length,
    totalEntityCount: entities.entities.length,
    duplicateScore: duplicate.score,
  };
}

export function processNormalizedItemAsSignal(
  item: NormalizedSignalItem,
  existingSignals: MinimalExistingSignal[] = []
): SignalProcessingResult {
  validateNormalizedItem(item);

  const signal = normalizeOrThrow(item);
  const entities = extractSignalEntities(signal);
  const enrichedSignal = applyExtractedEntitiesToSignal(signal, entities);
  const duplicate = findDuplicateSignal(enrichedSignal, existingSignals);
  const action = decideSignalProcessingAction(duplicate);

  return {
    signal: enrichedSignal,
    entities,
    duplicate,
    action,
    stage: "completed",
    reasons: [
      buildEntityReason(signal, enrichedSignal),
      duplicateReason(duplicate),
      `Action selected: ${action}.`,
    ],
    metrics: buildMetrics(entities, duplicate),
  };
}
