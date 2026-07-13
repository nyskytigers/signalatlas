import type { SignalType } from "../signals";

export const RELEVANCE_DIMENSIONS = [
  "researchRelevance",
  "novelty",
  "technologyImpact",
  "portfolioUsefulness",
  "graduateValue",
  "communityAttention",
] as const;

export type RelevanceDimension = (typeof RELEVANCE_DIMENSIONS)[number];

export type RelevanceWeights = Record<RelevanceDimension, number>;

export type RelevanceBand = "HIGH" | "MEDIUM" | "LOW" | "IGNORE";

export type RelevanceSignalType = SignalType | string;

export type RelevanceEngagementMetrics = {
  citations?: number | null;
  githubStars?: number | null;
  githubForks?: number | null;
  videoViews?: number | null;
  socialEngagements?: number | null;
  sourceCount?: number | null;
};

export type RelevanceScoringInput = {
  title?: string | null;
  summary?: string | null;
  description?: string | null;
  signalType?: RelevanceSignalType | null;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  ingestedAt?: Date | string | null;
  sourceName?: string | null;
  sourceCategory?: string | null;
  domains?: readonly string[] | null;
  technologies?: readonly string[] | null;
  organizations?: readonly string[] | null;
  researchers?: readonly string[] | null;
  projects?: readonly string[] | null;
  vessels?: readonly string[] | null;
  expeditions?: readonly string[] | null;
  archaeologicalSites?: readonly string[] | null;
  keywords?: readonly string[] | null;
  canonicalUrl?: string | null;
  doi?: string | null;
  externalId?: string | null;
  githubRepositoryUrl?: string | null;
  datasetUrl?: string | null;
  engagement?: RelevanceEngagementMetrics | null;
  raw?: unknown;
};

export type RelevanceRuleResult = {
  ruleId: string;
  dimension: RelevanceDimension;
  contribution: number;
  description: string;
  evidence: readonly string[];
  maxContribution?: number;
  metadata?: Record<string, string | number | boolean>;
};

export type DimensionAssessment = {
  dimension: RelevanceDimension;
  rawScore: number;
  score: number;
  maxScore: number;
  ruleResults: RelevanceRuleResult[];
};

export type RelevanceExplanation = {
  dimension: RelevanceDimension;
  ruleId: string;
  contribution: number;
  description: string;
  evidence: readonly string[];
};

export type DeterministicRelevanceAssessment = {
  version: string;
  dimensions: Record<RelevanceDimension, DimensionAssessment>;
  weights: RelevanceWeights;
  finalScore: number;
  band: RelevanceBand;
  explanations: RelevanceExplanation[];
  evaluatedAt?: never;
};

export type RelevanceCalculatorOptions = {
  weights?: Partial<Record<RelevanceDimension, number>>;
};
