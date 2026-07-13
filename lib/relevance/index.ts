export {
  calculateDeterministicRelevance,
  DETERMINISTIC_RELEVANCE_VERSION,
} from "./calculator";
export { scoreToBand } from "./bands";
export { extractRelevanceFeatures, type RelevanceFeatures } from "./features";
export {
  DEFAULT_RELEVANCE_WEIGHTS,
  relevanceWeightsFor,
  validateRelevanceWeights,
} from "./weights";
export type {
  DeterministicRelevanceAssessment,
  DimensionAssessment,
  RelevanceBand,
  RelevanceCalculatorOptions,
  RelevanceDimension,
  RelevanceEngagementMetrics,
  RelevanceExplanation,
  RelevanceRuleResult,
  RelevanceScoringInput,
  RelevanceWeights,
} from "./types";
