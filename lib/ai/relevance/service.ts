import { prisma } from "../../../db/prisma";
import {
  calculateDeterministicRelevance,
  DETERMINISTIC_RELEVANCE_VERSION,
  RELEVANCE_DIMENSIONS,
  type RelevanceDimension,
} from "../../relevance";
import { createNvidiaRelevanceProvider, NVIDIA_RELEVANCE_PROVIDER_VERSION } from "./providers/nvidia";
import { NVIDIA_RELEVANCE_PROMPT_VERSION } from "./prompt";
import { normalizeProviderAssessment } from "./normalize";
import type {
  AiRelevanceAssessment,
  AssessmentPersistenceClient,
  ProviderRequestMetadata,
  RelevanceAssessmentInput,
  RelevanceAssessmentProvider,
  RelevanceAssessmentRequestOptions,
  RelevanceAssessmentSignal,
  SignalRelevanceAssessmentCreateInput,
  StoredAiRelevanceAssessment,
  StoredAssessmentRecord,
} from "./types";

type AssessSignalOptions = RelevanceAssessmentRequestOptions & {
  provider?: RelevanceAssessmentProvider;
  client?: AssessmentPersistenceClient;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function dimensionsFromDeterministic(signal: RelevanceAssessmentSignal) {
  const deterministic = calculateDeterministicRelevance({
    title: signal.title,
    summary: signal.summary,
    signalType: signal.signalType,
    sourceName: signal.sourceName,
    canonicalUrl: signal.canonicalUrl,
    publishedAt: signal.publishedAt,
    domains: signal.domains,
    technologies: signal.technologies,
    organizations: signal.organizations,
    researchers: signal.researchers,
    keywords: signal.keywords,
    raw: signal.raw,
  });

  return {
    version: deterministic.version,
    finalScore: deterministic.finalScore,
    band: deterministic.band,
    dimensions: RELEVANCE_DIMENSIONS.reduce(
      (scores, dimension) => ({
        ...scores,
        [dimension]: deterministic.dimensions[dimension].score,
      }),
      {} as Record<RelevanceDimension, number>
    ),
  };
}

function providerInputFromSignal(signal: RelevanceAssessmentSignal): RelevanceAssessmentInput {
  return {
    signalId: signal.id,
    title: signal.title,
    summary: signal.summary,
    signalType: signal.signalType,
    sourceName: signal.sourceName,
    canonicalUrl: signal.canonicalUrl,
    publishedAt: signal.publishedAt,
    domains: signal.domains,
    technologies: signal.technologies,
    organizations: signal.organizations,
    researchers: signal.researchers,
    keywords: signal.keywords,
    deterministicAssessment: dimensionsFromDeterministic(signal),
  };
}

function successData(
  signalId: string,
  assessment: AiRelevanceAssessment,
  rawResponse: unknown,
  requestMetadata: ProviderRequestMetadata | null
): SignalRelevanceAssessmentCreateInput {
  return {
    signalId,
    assessmentType: "ai",
    provider: assessment.provider,
    model: assessment.model,
    providerVersion: assessment.providerVersion,
    promptVersion: assessment.promptVersion,
    scoringVersion: assessment.scoringVersion,
    dimensionsJson: assessment.dimensions,
    domainsJson: assessment.domains,
    technologiesJson: assessment.technologies,
    explanation: assessment.explanation,
    dimensionExplanationsJson: assessment.dimensionExplanations,
    warningsJson: assessment.warnings,
    providerConfidence: assessment.providerConfidence,
    normalizedConfidence: assessment.normalizedConfidence,
    finalScore: assessment.finalScore,
    band: assessment.band,
    rawResponseJson: rawResponse,
    requestMetadataJson: requestMetadata,
    status: "success",
    errorCode: null,
    errorMessage: null,
  };
}

function failureData(
  signalId: string,
  provider: RelevanceAssessmentProvider,
  error: unknown
): SignalRelevanceAssessmentCreateInput {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "unknown_error";
  const message = error instanceof Error ? error.message : String(error);

  return {
    signalId,
    assessmentType: "ai",
    provider: provider.provider,
    model: provider.model,
    providerVersion: provider.version || NVIDIA_RELEVANCE_PROVIDER_VERSION,
    promptVersion: NVIDIA_RELEVANCE_PROMPT_VERSION,
    scoringVersion: DETERMINISTIC_RELEVANCE_VERSION,
    dimensionsJson: Object.fromEntries(RELEVANCE_DIMENSIONS.map((dimension) => [dimension, 0])),
    domainsJson: [],
    technologiesJson: [],
    explanation: null,
    dimensionExplanationsJson: Object.fromEntries(
      RELEVANCE_DIMENSIONS.map((dimension) => [dimension, []])
    ),
    warningsJson: [],
    providerConfidence: 0,
    normalizedConfidence: 0,
    finalScore: 0,
    band: "IGNORE",
    rawResponseJson: null,
    requestMetadataJson: null,
    status: "failed",
    errorCode: code,
    errorMessage: message.slice(0, 1000),
  };
}

function storedFrom(record: StoredAssessmentRecord): StoredAiRelevanceAssessment {
  const dimensionsJson = isRecord(record.dimensionsJson) ? record.dimensionsJson : {};
  const dimensionExplanations = RELEVANCE_DIMENSIONS.reduce(
    (explanations, dimension) => ({
      ...explanations,
      [dimension]: [],
    }),
    {} as Record<RelevanceDimension, readonly string[]>
  );

  return {
    id: record.id,
    signalId: record.signalId,
    provider: "nvidia",
    model: record.model,
    providerVersion: record.providerVersion,
    promptVersion: record.promptVersion,
    scoringVersion: record.scoringVersion,
    domains: Array.isArray(record.domainsJson) ? record.domainsJson.filter((item): item is string => typeof item === "string") : [],
    technologies: Array.isArray(record.technologiesJson)
      ? record.technologiesJson.filter((item): item is string => typeof item === "string")
      : [],
    dimensions: RELEVANCE_DIMENSIONS.reduce(
      (dimensions, dimension) => ({
        ...dimensions,
        [dimension]: typeof dimensionsJson[dimension] === "number" ? dimensionsJson[dimension] : 0,
      }),
      {} as Record<RelevanceDimension, number>
    ),
    finalScore: record.finalScore,
    band: record.band as StoredAiRelevanceAssessment["band"],
    providerConfidence: record.providerConfidence,
    normalizedConfidence: record.normalizedConfidence,
    explanation: record.explanation ?? "",
    dimensionExplanations,
    warnings: [],
    status: record.status === "success" ? "success" : "failed",
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    createdAt: record.createdAt,
  };
}

export async function assessSignalWithNvidia(
  signalId: string,
  options: AssessSignalOptions = {}
): Promise<StoredAiRelevanceAssessment> {
  const client = options.client ?? (prisma as unknown as AssessmentPersistenceClient);
  const provider = options.provider ?? createNvidiaRelevanceProvider();
  const signal = await client.signal.findUnique({
    where: { id: signalId },
    select: {
      id: true,
      title: true,
      summary: true,
      canonicalUrl: true,
      signalType: true,
      sourceName: true,
      publishedAt: true,
      technologies: true,
      organizations: true,
      researchers: true,
      domains: true,
      keywords: true,
      raw: true,
    },
  });

  if (!signal) throw new Error(`Signal not found: ${signalId}`);

  try {
    const providerResult = await provider.assess(providerInputFromSignal(signal), options);
    const normalized = normalizeProviderAssessment(providerResult.assessment, {
      weights: options.weights,
    });
    const record = await client.signalRelevanceAssessment.create({
      data: successData(
        signal.id,
        normalized,
        options.storeRawResponse ? providerResult.rawResponse : null,
        providerResult.requestMetadata
      ),
    });

    return storedFrom(record);
  } catch (error) {
    const record = await client.signalRelevanceAssessment.create({
      data: failureData(signal.id, provider, error),
    });

    throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
      assessmentRecord: storedFrom(record),
    });
  }
}
