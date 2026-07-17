import { RerankingValidationError } from "./errors";
import type { RerankCandidate, RerankResult } from "./types";

const MAX_QUERY_LENGTH = 500;
const MAX_CANDIDATE_TEXT_LENGTH = 6000;

export function normalizeRerankQuery(query: string) {
  return query.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

export function normalizeRerankText(text: string) {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, MAX_CANDIDATE_TEXT_LENGTH);
}

export function validateRerankCandidates(
  candidates: readonly RerankCandidate[],
  maxCandidates: number
) {
  if (candidates.length === 0) return [];
  if (candidates.length > maxCandidates) {
    throw new RerankingValidationError(`Rerank candidate count exceeds ${maxCandidates}.`);
  }

  const seenIds = new Set<string>();
  const seenRanks = new Set<number>();
  return candidates.map((candidate, index) => {
    const id = candidate.id.trim();
    const text = normalizeRerankText(candidate.text);
    if (!id) throw new RerankingValidationError(`Rerank candidate ${index} must include an id.`);
    if (!text) throw new RerankingValidationError(`Rerank candidate ${index} must include text.`);
    if (seenIds.has(id)) throw new RerankingValidationError(`Rerank candidate id ${id} is duplicated.`);
    if (!Number.isInteger(candidate.originalRank) || candidate.originalRank <= 0) {
      throw new RerankingValidationError(`Rerank candidate ${id} must include a positive originalRank.`);
    }
    if (seenRanks.has(candidate.originalRank)) {
      throw new RerankingValidationError(`Rerank originalRank ${candidate.originalRank} is duplicated.`);
    }
    if (
      candidate.retrievalScore != null &&
      !Number.isFinite(candidate.retrievalScore)
    ) {
      throw new RerankingValidationError(`Rerank candidate ${id} has an invalid retrievalScore.`);
    }

    seenIds.add(id);
    seenRanks.add(candidate.originalRank);
    return {
      ...candidate,
      id,
      text,
    };
  });
}

export function validateTopN(topN: number, candidateCount: number) {
  if (!Number.isInteger(topN) || topN <= 0) {
    throw new RerankingValidationError("Rerank topN must be a positive integer.");
  }
  return Math.min(topN, candidateCount);
}

export function validateRerankResults(
  results: readonly RerankResult[],
  candidates: readonly RerankCandidate[],
  topN: number
) {
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const seenIds = new Set<string>();
  const seenRanks = new Set<number>();
  const boundedTopN = validateTopN(topN, candidates.length);
  if (results.length > boundedTopN) {
    throw new RerankingValidationError("Rerank result count exceeds topN.");
  }

  for (const result of results) {
    const candidate = candidateById.get(result.id);
    if (!candidate) {
      throw new RerankingValidationError("Rerank result references an unknown candidate.");
    }
    if (seenIds.has(result.id)) {
      throw new RerankingValidationError("Rerank result contains duplicate candidates.");
    }
    if (!Number.isInteger(result.originalRank) || result.originalRank <= 0) {
      throw new RerankingValidationError("Rerank result has an invalid originalRank.");
    }
    if (result.originalRank !== candidate.originalRank) {
      throw new RerankingValidationError("Rerank result originalRank does not match its candidate.");
    }
    if (!Number.isInteger(result.rerankedRank) || result.rerankedRank <= 0) {
      throw new RerankingValidationError("Rerank result has an invalid rerankedRank.");
    }
    if (seenRanks.has(result.rerankedRank)) {
      throw new RerankingValidationError("Rerank result has a duplicate rerankedRank.");
    }
    if (!Number.isFinite(result.rerankScore)) {
      throw new RerankingValidationError("Rerank result has an invalid score.");
    }
    seenIds.add(result.id);
    seenRanks.add(result.rerankedRank);
  }

  const sorted = [...results].sort(
    (a, b) => a.rerankedRank - b.rerankedRank || a.originalRank - b.originalRank || a.id.localeCompare(b.id)
  );
  for (const [index, result] of sorted.entries()) {
    if (result.rerankedRank !== index + 1) {
      throw new RerankingValidationError("Rerank result ranks must be consecutive.");
    }
  }
  return sorted;
}

export const RERANKING_INPUT_LIMITS = {
  maxQueryLength: MAX_QUERY_LENGTH,
  maxCandidateTextLength: MAX_CANDIDATE_TEXT_LENGTH,
} as const;
