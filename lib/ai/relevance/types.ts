import type {
  RelevanceBand,
  RelevanceDimension,
  RelevanceScoringInput,
  RelevanceWeights,
} from "../../relevance";

export type RelevanceProviderName = "nvidia";

export type ProviderDimensionScores = Record<RelevanceDimension, number>;

export type RelevanceAssessmentInput = RelevanceScoringInput & {
  signalId?: string | null;
  deterministicAssessment?: {
    version: string;
    finalScore: number;
    band: RelevanceBand;
    dimensions: ProviderDimensionScores;
  } | null;
};

export type NormalizedRelevanceAssessmentInput = {
  signalId: string | null;
  title: string;
  summary: string | null;
  signalType: string | null;
  sourceName: string | null;
  sourceCategory: string | null;
  publishedAt: string | null;
  canonicalUrl: string | null;
  domains: readonly string[];
  technologies: readonly string[];
  organizations: readonly string[];
  researchers: readonly string[];
  projects: readonly string[];
  vessels: readonly string[];
  expeditions: readonly string[];
  archaeologicalSites: readonly string[];
  keywords: readonly string[];
  repository: {
    url: string | null;
  };
  dataset: {
    url: string | null;
  };
  engagement: {
    citations: number | null;
    githubStars: number | null;
    githubForks: number | null;
    videoViews: number | null;
    socialEngagements: number | null;
    sourceCount: number | null;
  };
  deterministicAssessment: RelevanceAssessmentInput["deterministicAssessment"];
};

export type RelevanceAssessmentRequestOptions = {
  timeoutMs?: number;
  maxRetries?: number;
  storeRawResponse?: boolean;
  dryRun?: boolean;
  weights?: Partial<RelevanceWeights>;
};

export type ProviderDomainAssessment = {
  domain: string;
  confidence: number;
  evidence: readonly string[];
};

export type ProviderTechnologyAssessment = {
  technology: string;
  confidence: number;
  evidence: readonly string[];
};

export type ProviderRelevanceAssessment = {
  provider: RelevanceProviderName;
  model: string;
  providerVersion: string;
  promptVersion: string;
  domains: readonly ProviderDomainAssessment[];
  technologies: readonly ProviderTechnologyAssessment[];
  dimensionScores: ProviderDimensionScores;
  confidence: number;
  explanation: string;
  dimensionExplanations: Record<RelevanceDimension, readonly string[]>;
  warnings: readonly string[];
};

export type ProviderRequestMetadata = {
  durationMs: number;
  retryCount: number;
  providerRequestId?: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

export type ProviderAssessmentWithMetadata = {
  assessment: ProviderRelevanceAssessment;
  rawResponse: unknown;
  requestMetadata: ProviderRequestMetadata;
};

export type AiRelevanceAssessment = {
  provider: RelevanceProviderName;
  model: string;
  providerVersion: string;
  promptVersion: string;
  scoringVersion: string;
  domains: readonly string[];
  technologies: readonly string[];
  dimensions: ProviderDimensionScores;
  finalScore: number;
  band: RelevanceBand;
  providerConfidence: number;
  normalizedConfidence: number;
  explanation: string;
  dimensionExplanations: Record<RelevanceDimension, readonly string[]>;
  warnings: readonly string[];
};

export type StoredAiRelevanceAssessment = AiRelevanceAssessment & {
  id: string;
  signalId: string;
  status: "success" | "failed";
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt?: Date;
};

export interface RelevanceAssessmentProvider {
  readonly provider: RelevanceProviderName;
  readonly model: string;
  readonly version: string;

  assess(
    input: RelevanceAssessmentInput,
    options?: RelevanceAssessmentRequestOptions
  ): Promise<ProviderAssessmentWithMetadata>;
}

export type AssessmentPersistenceClient = {
  signal: {
    findUnique(args: {
      where: { id: string };
      select: {
        id: true;
        title: true;
        summary: true;
        canonicalUrl: true;
        signalType: true;
        sourceName: true;
        publishedAt: true;
        technologies: true;
        organizations: true;
        researchers: true;
        domains: true;
        keywords: true;
        raw: true;
      };
    }): Promise<RelevanceAssessmentSignal | null>;
  };
  signalRelevanceAssessment: {
    create(args: { data: SignalRelevanceAssessmentCreateInput }): Promise<StoredAssessmentRecord>;
  };
};

export type RelevanceAssessmentSignal = {
  id: string;
  title: string;
  summary: string | null;
  canonicalUrl: string;
  signalType: string;
  sourceName: string | null;
  publishedAt: Date | null;
  technologies: string[];
  organizations: string[];
  researchers: string[];
  domains: string[];
  keywords: string[];
  raw: unknown;
};

export type SignalRelevanceAssessmentCreateInput = {
  signalId: string;
  assessmentType: string;
  provider: string;
  model: string;
  providerVersion: string;
  promptVersion: string;
  scoringVersion: string;
  dimensionsJson: unknown;
  domainsJson: unknown;
  technologiesJson: unknown;
  explanation?: string | null;
  dimensionExplanationsJson?: unknown;
  warningsJson?: unknown;
  providerConfidence: number;
  normalizedConfidence: number;
  finalScore: number;
  band: string;
  rawResponseJson?: unknown;
  requestMetadataJson?: unknown;
  status: string;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type StoredAssessmentRecord = SignalRelevanceAssessmentCreateInput & {
  id: string;
  createdAt: Date;
};
