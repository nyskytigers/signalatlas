export type EmbeddingStatus = "SUCCESS" | "FAILED" | "SKIPPED" | "DISABLED";
export type EmbeddingInputType = "query" | "passage";

export type EmbeddingRequestOptions = {
  timeoutMs?: number;
  maxRetries?: number;
  inputType?: EmbeddingInputType;
};

export type EmbeddingResult = {
  index: number;
  embedding: readonly number[];
};

export interface EmbeddingProvider {
  readonly provider: string;
  readonly model: string;
  readonly version: string;
  readonly dimensions: number;
  readonly maxBatchSize: number;

  embed(
    inputs: readonly string[],
    options?: EmbeddingRequestOptions
  ): Promise<readonly EmbeddingResult[]>;
}

export type SignalEmbeddingSource = {
  id: string;
  title: string;
  summary: string | null;
  canonicalUrl: string;
  signalType: string;
  sourceName: string | null;
  publishedAt: Date | null;
  domains: readonly string[];
  technologies: readonly string[];
  organizations: readonly string[];
  researchers: readonly string[];
  keywords: readonly string[];
  projects?: readonly string[];
  vessels?: readonly string[];
  expeditions?: readonly string[];
  archaeologicalSites?: readonly string[];
};

export type EmbeddingVersionMetadata = {
  provider: string;
  model: string;
  providerVersion: string;
  inputVersion: string;
  dimensions: number;
  embeddingVersion: string;
};

export type SignalEmbeddingRecord = {
  id: string;
  signalId: string;
  provider: string;
  model: string;
  providerVersion: string;
  embeddingVersion: string;
  inputVersion: string;
  dimensions: number;
  contentHash: string;
  sourceTextHash: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type EmbedSignalResult = {
  signalId: string;
  status: EmbeddingStatus;
  embeddingId?: string;
  contentHash?: string;
  skippedReason?: string;
  errorCode?: string;
  errorMessage?: string;
};

export type SemanticSearchFilters = {
  signalType?: string;
  domain?: string;
  technology?: string;
  sourceName?: string;
  publishedAfter?: Date | string;
  publishedBefore?: Date | string;
};

export type SemanticSignalSearchResult = {
  signalId: string;
  title: string;
  url: string;
  signalType: string;
  similarity: number;
  provider: string;
  model: string;
  embeddingVersion: string;
};

export type HybridSignalSearchResult = {
  signal: {
    id: string;
    title: string;
    url: string;
    signalType: string;
  };
  hybridScore: number;
  semanticScore: number;
  keywordScore: number;
  matchedBy: readonly ("semantic" | "keyword")[];
  provider?: string;
  model?: string;
  embeddingVersion?: string;
};

export type RerankedSignalSearchResult = HybridSignalSearchResult & {
  originalRank: number;
  rerankedRank: number;
  rerankScore: number | null;
  reranked: boolean;
};

export type RerankedSignalSearchResponse = {
  results: readonly RerankedSignalSearchResult[];
  retrievalLatencyMs: number;
  candidatePreparationLatencyMs: number;
  rerankingLatencyMs: number;
  totalLatencyMs: number;
  rerankingStatus: "success" | "failed" | "disabled" | "skipped";
  fallbackUsed: boolean;
  candidatesRetrieved: number;
  provider?: string;
  model?: string;
  errorCode?: string;
};

export type EmbeddingRepository = {
  findSignal(signalId: string): Promise<SignalEmbeddingSource | null>;
  findSignals(args: {
    signalIds?: readonly string[];
    limit: number;
    onlyMissing?: boolean;
    version: EmbeddingVersionMetadata;
  }): Promise<readonly SignalEmbeddingSource[]>;
  findCompatibleEmbedding(args: {
    signalId: string;
    version: EmbeddingVersionMetadata;
  }): Promise<SignalEmbeddingRecord | null>;
  upsertSuccess(args: {
    signalId: string;
    version: EmbeddingVersionMetadata;
    contentHash: string;
    sourceTextHash: string;
    embedding: readonly number[];
    metadata?: unknown;
  }): Promise<SignalEmbeddingRecord>;
  upsertFailure(args: {
    signalId: string;
    version: EmbeddingVersionMetadata;
    contentHash: string;
    sourceTextHash: string;
    errorCode: string;
    errorMessage: string;
  }): Promise<SignalEmbeddingRecord>;
  searchByVector(args: {
    vector: readonly number[];
    version: EmbeddingVersionMetadata;
    limit: number;
    filters?: SemanticSearchFilters;
  }): Promise<readonly SemanticSignalSearchResult[]>;
  searchKeyword(args: {
    query: string;
    limit: number;
    filters?: SemanticSearchFilters;
  }): Promise<readonly { signalId: string; title: string; url: string; signalType: string; score: number }[]>;
};
