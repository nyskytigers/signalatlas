import { RELEVANCE_DIMENSIONS, type RelevanceWeights } from "./types";

const WEIGHT_TOTAL_TOLERANCE = 0.000001;

export const DEFAULT_RELEVANCE_WEIGHTS = Object.freeze({
  researchRelevance: 0.3,
  novelty: 0.2,
  technologyImpact: 0.2,
  portfolioUsefulness: 0.15,
  graduateValue: 0.1,
  communityAttention: 0.05,
} satisfies RelevanceWeights);

export function validateRelevanceWeights(
  weights: Partial<Record<keyof RelevanceWeights, number>>
): RelevanceWeights {
  const normalized: RelevanceWeights = {
    researchRelevance: 0,
    novelty: 0,
    technologyImpact: 0,
    portfolioUsefulness: 0,
    graduateValue: 0,
    communityAttention: 0,
  };

  for (const dimension of RELEVANCE_DIMENSIONS) {
    const value = weights[dimension];

    if (value == null) {
      throw new Error(`Missing relevance weight for ${dimension}.`);
    }

    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`Relevance weight for ${dimension} must be finite.`);
    }

    if (value < 0) {
      throw new Error(`Relevance weight for ${dimension} must not be negative.`);
    }

    normalized[dimension] = value;
  }

  const unknownKeys = Object.keys(weights).filter(
    (key) => !RELEVANCE_DIMENSIONS.includes(key as keyof RelevanceWeights)
  );
  if (unknownKeys.length > 0) {
    throw new Error(`Unsupported relevance weight dimensions: ${unknownKeys.join(", ")}.`);
  }

  const total = RELEVANCE_DIMENSIONS.reduce(
    (sum, dimension) => sum + (normalized[dimension] ?? 0),
    0
  );

  if (Math.abs(total - 1) > WEIGHT_TOTAL_TOLERANCE) {
    throw new Error(`Relevance weights must total 1. Received ${total}.`);
  }

  return {
    researchRelevance: normalized.researchRelevance,
    novelty: normalized.novelty,
    technologyImpact: normalized.technologyImpact,
    portfolioUsefulness: normalized.portfolioUsefulness,
    graduateValue: normalized.graduateValue,
    communityAttention: normalized.communityAttention,
  };
}

export function relevanceWeightsFor(
  weights?: Partial<Record<keyof RelevanceWeights, number>>
) {
  return weights ? validateRelevanceWeights(weights) : { ...DEFAULT_RELEVANCE_WEIGHTS };
}
