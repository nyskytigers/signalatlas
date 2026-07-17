export {
  NVIDIA_EMBEDDING_PROFILE,
  getNvidiaEmbeddingConfig,
  type NvidiaEmbeddingConfig,
} from "./config";
export {
  SIGNAL_EMBEDDING_INPUT_LIMITS,
  SIGNAL_EMBEDDING_INPUT_VERSION,
  buildSignalEmbeddingText,
  embeddingVersionFor,
  hashSignalEmbeddingText,
} from "./input";
export {
  backfillSignalEmbeddings,
  embedSignal,
  embedSignalIfNeeded,
  embedSignals,
  embeddingVersionMetadata,
} from "./service";
export { createPrismaEmbeddingRepository } from "./repository";
export { SEMANTIC_SEARCH_LIMITS, searchSignalsByEmbedding } from "./search";
export { HYBRID_SEARCH_DEFAULTS, searchSignalsHybrid } from "./hybrid";
export { RERANKED_SEARCH_LIMITS, searchSignalsHybridReranked } from "./reranked";
export {
  NVIDIA_EMBEDDING_PROVIDER_VERSION,
  createNvidiaEmbeddingProvider,
} from "./providers/nvidia";
export {
  EmbeddingConfigurationError,
  EmbeddingError,
  EmbeddingHttpError,
  EmbeddingProviderDisabledError,
  EmbeddingRateLimitError,
  EmbeddingTimeoutError,
  EmbeddingValidationError,
} from "./errors";
export { validateEmbeddingResults, validateEmbeddingVector } from "./validation";
export type {
  EmbedSignalResult,
  EmbeddingProvider,
  EmbeddingInputType,
  EmbeddingRepository,
  EmbeddingRequestOptions,
  EmbeddingResult,
  EmbeddingStatus,
  EmbeddingVersionMetadata,
  HybridSignalSearchResult,
  RerankedSignalSearchResponse,
  RerankedSignalSearchResult,
  SemanticSearchFilters,
  SemanticSignalSearchResult,
  SignalEmbeddingRecord,
  SignalEmbeddingSource,
} from "./types";
