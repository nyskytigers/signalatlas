import { scoreToBand } from "./bands";
import { extractRelevanceFeatures, type RelevanceFeatures } from "./features";
import {
  communityAttentionRules,
  graduateValueRules,
  noveltyRules,
  portfolioUsefulnessRules,
  researchRelevanceRules,
  technologyImpactRules,
} from "./rules";
import {
  RELEVANCE_DIMENSIONS,
  type DeterministicRelevanceAssessment,
  type DimensionAssessment,
  type RelevanceCalculatorOptions,
  type RelevanceDimension,
  type RelevanceExplanation,
  type RelevanceRuleResult,
  type RelevanceScoringInput,
} from "./types";
import { clampScore } from "./utils";
import { relevanceWeightsFor } from "./weights";

export const DETERMINISTIC_RELEVANCE_VERSION = "1.0.0";

type RuleEvaluator = (features: RelevanceFeatures) => RelevanceRuleResult[];

const RULE_EVALUATORS: Record<RelevanceDimension, RuleEvaluator> = {
  researchRelevance: researchRelevanceRules,
  novelty: noveltyRules,
  technologyImpact: technologyImpactRules,
  portfolioUsefulness: portfolioUsefulnessRules,
  graduateValue: graduateValueRules,
  communityAttention: communityAttentionRules,
};

const DIMENSION_MAX_SCORE = 100;

function compareRuleResults(a: RelevanceRuleResult, b: RelevanceRuleResult) {
  return (
    b.contribution - a.contribution ||
    RELEVANCE_DIMENSIONS.indexOf(a.dimension) - RELEVANCE_DIMENSIONS.indexOf(b.dimension) ||
    a.ruleId.localeCompare(b.ruleId)
  );
}

function uniqueRuleResults(ruleResults: RelevanceRuleResult[]) {
  const unique = new Map<string, RelevanceRuleResult>();

  for (const result of ruleResults) {
    const key = `${result.dimension}:${result.ruleId}`;
    if (!unique.has(key)) {
      unique.set(key, {
        ...result,
        contribution: clampScore(result.contribution),
        evidence: [...result.evidence].sort(),
      });
    }
  }

  return Array.from(unique.values()).sort(compareRuleResults);
}

function assessDimension(
  dimension: RelevanceDimension,
  features: RelevanceFeatures
): DimensionAssessment {
  const ruleResults = uniqueRuleResults(RULE_EVALUATORS[dimension](features));
  const rawScore = clampScore(
    ruleResults.reduce((sum, result) => sum + result.contribution, 0)
  );

  return {
    dimension,
    rawScore,
    score: Math.round((rawScore / DIMENSION_MAX_SCORE) * 100),
    maxScore: DIMENSION_MAX_SCORE,
    ruleResults,
  };
}

function explanationsFor(dimensions: Record<RelevanceDimension, DimensionAssessment>) {
  const explanations: RelevanceExplanation[] = [];

  for (const dimension of RELEVANCE_DIMENSIONS) {
    for (const result of dimensions[dimension].ruleResults) {
      if (result.contribution <= 0) continue;

      explanations.push({
        dimension: result.dimension,
        ruleId: result.ruleId,
        contribution: result.contribution,
        description: result.description,
        evidence: result.evidence,
      });
    }
  }

  return explanations.sort(compareRuleResults);
}

export function calculateDeterministicRelevance(
  input: RelevanceScoringInput,
  options: RelevanceCalculatorOptions = {}
): DeterministicRelevanceAssessment {
  const features = extractRelevanceFeatures(input);
  const weights = relevanceWeightsFor(options.weights);
  const dimensions = RELEVANCE_DIMENSIONS.reduce(
    (assessments, dimension) => ({
      ...assessments,
      [dimension]: assessDimension(dimension, features),
    }),
    {} as Record<RelevanceDimension, DimensionAssessment>
  );
  const weightedScore = RELEVANCE_DIMENSIONS.reduce(
    (sum, dimension) => sum + dimensions[dimension].score * weights[dimension],
    0
  );
  const finalScore = Math.round(clampScore(weightedScore));

  return {
    version: DETERMINISTIC_RELEVANCE_VERSION,
    dimensions,
    weights,
    finalScore,
    band: scoreToBand(finalScore),
    explanations: explanationsFor(dimensions),
  };
}
