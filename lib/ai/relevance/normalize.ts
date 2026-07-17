import {
  DETERMINISTIC_RELEVANCE_VERSION,
  RELEVANCE_DIMENSIONS,
  relevanceWeightsFor,
  scoreToBand,
  type RelevanceBand,
  type RelevanceDimension,
} from "../../relevance";
import { resolveTechnologyNames } from "../../signals";
import type {
  AiRelevanceAssessment,
  NormalizedRelevanceAssessmentInput,
  ProviderDimensionScores,
  ProviderRelevanceAssessment,
  RelevanceAssessmentInput,
} from "./types";

const MAX_TEXT_LENGTH = 4000;
const MAX_ARRAY_ITEMS = 20;
const MAX_VALUE_LENGTH = 240;
const MAX_EXPLANATION_LENGTH = 1200;
const RECOGNIZED_DOMAINS = [
  "marineArchaeology",
  "underwaterRobotics",
  "xrHci",
  "digitalHeritage",
  "oceanMapping",
  "conservation",
] as const;

function normalizeText(value: string | null | undefined, maxLength = MAX_TEXT_LENGTH) {
  const normalized = (value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength).trimEnd() : normalized;
}

function normalizeOptionalText(value: string | null | undefined, maxLength = MAX_VALUE_LENGTH) {
  const normalized = normalizeText(value, maxLength);
  return normalized || null;
}

function uniqueStrings(values: readonly string[] | null | undefined, maxItems = MAX_ARRAY_ITEMS) {
  const strings = new Map<string, string>();

  for (const value of values ?? []) {
    const normalized = normalizeText(value, MAX_VALUE_LENGTH);
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (!strings.has(key)) strings.set(key, normalized);
  }

  return Array.from(strings.values())
    .sort((a, b) => a.localeCompare(b))
    .slice(0, maxItems);
}

function normalizeDate(value: Date | string | null | undefined) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

function normalizeMetric(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function recognizedDomains(values: readonly string[]) {
  const recognized = new Set(RECOGNIZED_DOMAINS);
  return uniqueStrings(values).filter((value) => recognized.has(value as (typeof RECOGNIZED_DOMAINS)[number]));
}

function calculateWeightedScore(dimensions: ProviderDimensionScores, weights?: Parameters<typeof relevanceWeightsFor>[0]) {
  const validatedWeights = relevanceWeightsFor(weights);
  const weighted = RELEVANCE_DIMENSIONS.reduce(
    (sum, dimension) => sum + dimensions[dimension] * validatedWeights[dimension],
    0
  );
  return Math.round(clamp(weighted, 0, 100));
}

function explanationCompleteness(assessment: ProviderRelevanceAssessment) {
  const completeDimensions = RELEVANCE_DIMENSIONS.filter(
    (dimension) => assessment.dimensionExplanations[dimension].length > 0
  ).length;
  const hasSummary = assessment.explanation.trim().length > 0;
  return (completeDimensions / RELEVANCE_DIMENSIONS.length) * (hasSummary ? 1 : 0.8);
}

export function normalizeAssessmentInput(
  input: RelevanceAssessmentInput
): NormalizedRelevanceAssessmentInput {
  return {
    signalId: normalizeOptionalText(input.signalId, 120),
    title: normalizeText(input.title ?? "", 600),
    summary: normalizeOptionalText(input.summary ?? input.description ?? null, MAX_TEXT_LENGTH),
    signalType: normalizeOptionalText(input.signalType ?? null, 80),
    sourceName: normalizeOptionalText(input.sourceName, 160),
    sourceCategory: normalizeOptionalText(input.sourceCategory, 120),
    publishedAt: normalizeDate(input.publishedAt),
    canonicalUrl: normalizeOptionalText(input.canonicalUrl, 500),
    domains: uniqueStrings(input.domains),
    technologies: uniqueStrings(input.technologies),
    organizations: uniqueStrings(input.organizations),
    researchers: uniqueStrings(input.researchers),
    projects: uniqueStrings(input.projects),
    vessels: uniqueStrings(input.vessels),
    expeditions: uniqueStrings(input.expeditions),
    archaeologicalSites: uniqueStrings(input.archaeologicalSites),
    keywords: uniqueStrings(input.keywords),
    repository: {
      url: normalizeOptionalText(input.githubRepositoryUrl, 500),
    },
    dataset: {
      url: normalizeOptionalText(input.datasetUrl, 500),
    },
    engagement: {
      citations: normalizeMetric(input.engagement?.citations),
      githubStars: normalizeMetric(input.engagement?.githubStars),
      githubForks: normalizeMetric(input.engagement?.githubForks),
      videoViews: normalizeMetric(input.engagement?.videoViews),
      socialEngagements: normalizeMetric(input.engagement?.socialEngagements),
      sourceCount: normalizeMetric(input.engagement?.sourceCount),
    },
    deterministicAssessment: input.deterministicAssessment ?? null,
  };
}

export function normalizeProviderAssessment(
  assessment: ProviderRelevanceAssessment,
  options: { weights?: Parameters<typeof relevanceWeightsFor>[0] } = {}
): AiRelevanceAssessment {
  const recognizedDomainValues = recognizedDomains(assessment.domains.map((domain) => domain.domain));
  const proposedTechnologies = assessment.technologies.map((technology) => technology.technology);
  const recognizedTechnologies = resolveTechnologyNames(proposedTechnologies);
  const domainRecognition =
    assessment.domains.length === 0 ? 1 : recognizedDomainValues.length / assessment.domains.length;
  const technologyRecognition =
    assessment.technologies.length === 0
      ? 1
      : recognizedTechnologies.length / assessment.technologies.length;
  const validationFactor = 1;
  const recognitionFactor = Math.min(domainRecognition, technologyRecognition);
  const explanationFactor = explanationCompleteness(assessment);
  const warningFactor = Math.max(0.6, 1 - assessment.warnings.length * 0.05);
  const normalizedConfidence = clamp(
    assessment.confidence * validationFactor * recognitionFactor * explanationFactor * warningFactor,
    0,
    1
  );
  const finalScore = calculateWeightedScore(assessment.dimensionScores, options.weights);
  const band: RelevanceBand = scoreToBand(finalScore);

  return {
    provider: "nvidia",
    model: assessment.model,
    providerVersion: assessment.providerVersion,
    promptVersion: assessment.promptVersion,
    scoringVersion: DETERMINISTIC_RELEVANCE_VERSION,
    domains: recognizedDomainValues,
    technologies: recognizedTechnologies,
    dimensions: { ...assessment.dimensionScores },
    finalScore,
    band,
    providerConfidence: clamp(assessment.confidence, 0, 1),
    normalizedConfidence,
    explanation: normalizeText(assessment.explanation, MAX_EXPLANATION_LENGTH),
    dimensionExplanations: RELEVANCE_DIMENSIONS.reduce(
      (output, dimension) => ({
        ...output,
        [dimension]: uniqueStrings(assessment.dimensionExplanations[dimension], 4),
      }),
      {} as Record<RelevanceDimension, readonly string[]>
    ),
    warnings: uniqueStrings(
      [
        ...assessment.warnings,
        ...proposedTechnologies
          .filter((technology) => !resolveTechnologyNames([technology]).length)
          .map((technology) => `Unrecognized technology excluded: ${technology}`),
      ],
      10
    ),
  };
}

export const PROVIDER_INPUT_LIMITS = {
  maxTextLength: MAX_TEXT_LENGTH,
  maxArrayItems: MAX_ARRAY_ITEMS,
  maxValueLength: MAX_VALUE_LENGTH,
} as const;
