import { createNvidiaEmbeddingProvider } from "./providers/nvidia";
import { createPrismaEmbeddingRepository } from "./repository";
import { embeddingVersionMetadata } from "./service";
import { buildSignalEmbeddingText } from "./input";
import { searchSignalsHybrid } from "./hybrid";
import {
  createNvidiaRerankingProvider,
  normalizeRerankQuery,
  rerankCandidates,
  RerankingError,
  RerankingProviderDisabledError,
  type RerankingProvider,
} from "../reranking";
import type {
  EmbeddingProvider,
  EmbeddingRepository,
  HybridSignalSearchResult,
  RerankedSignalSearchResponse,
  RerankedSignalSearchResult,
  SemanticSearchFilters,
  SignalEmbeddingSource,
} from "./types";

const DEFAULT_CANDIDATE_LIMIT = 30;
const DEFAULT_RESULT_LIMIT = 10;

function boundedCandidateLimit(limit: number | undefined, maxCandidates: number) {
  const requested = limit == null || !Number.isInteger(limit) || limit <= 0 ? DEFAULT_CANDIDATE_LIMIT : limit;
  return Math.min(requested, DEFAULT_CANDIDATE_LIMIT, maxCandidates);
}

function boundedResultLimit(limit: number | undefined, maxResults: number, candidateLimit: number) {
  const requested = limit == null || !Number.isInteger(limit) || limit <= 0 ? DEFAULT_RESULT_LIMIT : limit;
  return Math.min(requested, DEFAULT_RESULT_LIMIT, maxResults, candidateLimit);
}

function sanitizeCandidateValue(value: string | null | undefined) {
  const plainText = (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/[^\s<>"']+/gi, " ")
    .replace(
      /\b(api[_-]?key|access[_-]?token|token|secret|password|authorization)\b\s*[:=]\s*(?:Bearer\s+)?[^\s,;]+/gi,
      "$1 [redacted]"
    )
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  const looksLikeJson =
    (plainText.startsWith("{") && plainText.endsWith("}")) ||
    (plainText.startsWith("[") && plainText.endsWith("]"));
  return looksLikeJson ? "" : plainText;
}

function sanitizeCandidateValues(values: readonly string[] | undefined) {
  return (values ?? []).map(sanitizeCandidateValue).filter(Boolean);
}

function candidateText(signal: SignalEmbeddingSource | undefined, fallback: HybridSignalSearchResult) {
  if (signal) {
    return buildSignalEmbeddingText({
      ...signal,
      title: sanitizeCandidateValue(signal.title),
      summary: sanitizeCandidateValue(signal.summary) || null,
      sourceName: sanitizeCandidateValue(signal.sourceName) || null,
      domains: sanitizeCandidateValues(signal.domains),
      technologies: sanitizeCandidateValues(signal.technologies),
      organizations: sanitizeCandidateValues(signal.organizations),
      researchers: sanitizeCandidateValues(signal.researchers),
      keywords: sanitizeCandidateValues(signal.keywords),
      projects: sanitizeCandidateValues(signal.projects),
      vessels: sanitizeCandidateValues(signal.vessels),
      expeditions: sanitizeCandidateValues(signal.expeditions),
      archaeologicalSites: sanitizeCandidateValues(signal.archaeologicalSites),
    });
  }
  return `Title: ${sanitizeCandidateValue(fallback.signal.title)}\nType: ${sanitizeCandidateValue(
    fallback.signal.signalType
  )}`;
}

function fallbackResults(
  results: readonly HybridSignalSearchResult[],
  limit: number
): readonly RerankedSignalSearchResult[] {
  return results.slice(0, limit).map((result, index) => ({
    ...result,
    originalRank: index + 1,
    rerankedRank: index + 1,
    rerankScore: null,
    reranked: false,
  }));
}

function errorCode(error: unknown) {
  if (error instanceof RerankingError) return error.code;
  return "reranking_failed";
}

export async function searchSignalsHybridReranked(args: {
  query: string;
  candidateLimit?: number;
  limit?: number;
  semanticWeight?: number;
  keywordWeight?: number;
  filters?: SemanticSearchFilters;
  embeddingProvider?: EmbeddingProvider;
  rerankingProvider?: RerankingProvider;
  repository?: EmbeddingRepository;
}): Promise<RerankedSignalSearchResponse> {
  const totalStartedAt = performance.now();
  const query = normalizeRerankQuery(args.query);
  if (!query) {
    return {
      results: [],
      retrievalLatencyMs: 0,
      candidatePreparationLatencyMs: 0,
      rerankingLatencyMs: 0,
      totalLatencyMs: 0,
      rerankingStatus: "skipped",
      fallbackUsed: false,
      candidatesRetrieved: 0,
    };
  }

  const embeddingProvider = args.embeddingProvider ?? createNvidiaEmbeddingProvider();
  const repository = args.repository ?? createPrismaEmbeddingRepository();
  let rerankingProvider = args.rerankingProvider;
  let rerankingProviderError: unknown = null;
  if (!rerankingProvider) {
    try {
      rerankingProvider = createNvidiaRerankingProvider();
    } catch (error) {
      rerankingProviderError = error;
    }
  }
  const candidateLimit = boundedCandidateLimit(
    args.candidateLimit,
    rerankingProvider?.maxCandidates ?? DEFAULT_CANDIDATE_LIMIT
  );
  const resultLimit = boundedResultLimit(
    args.limit,
    rerankingProvider?.maxResults ?? DEFAULT_RESULT_LIMIT,
    candidateLimit
  );

  const retrievalStartedAt = performance.now();
  const retrieved = await searchSignalsHybrid({
    query,
    limit: candidateLimit,
    semanticWeight: args.semanticWeight,
    keywordWeight: args.keywordWeight,
    filters: args.filters,
    provider: embeddingProvider,
    repository,
  });
  const retrievalLatencyMs = Math.max(0, performance.now() - retrievalStartedAt);

  if (retrieved.length === 0) {
    return {
      results: [],
      retrievalLatencyMs,
      candidatePreparationLatencyMs: 0,
      rerankingLatencyMs: 0,
      totalLatencyMs: Math.max(0, performance.now() - totalStartedAt),
      rerankingStatus: "skipped",
      fallbackUsed: false,
      candidatesRetrieved: 0,
      provider: rerankingProvider?.provider,
      model: rerankingProvider?.model,
    };
  }

  if (rerankingProviderError || !rerankingProvider) {
    return {
      results: fallbackResults(retrieved, resultLimit),
      retrievalLatencyMs,
      candidatePreparationLatencyMs: 0,
      rerankingLatencyMs: 0,
      totalLatencyMs: Math.max(0, performance.now() - totalStartedAt),
      rerankingStatus: "failed",
      fallbackUsed: true,
      candidatesRetrieved: retrieved.length,
      errorCode: errorCode(rerankingProviderError),
    };
  }

  const candidatePreparationStartedAt = performance.now();
  const signalIds = retrieved.map((result) => result.signal.id);
  const signals = await repository.findSignals({
    signalIds,
    limit: signalIds.length,
    onlyMissing: false,
    version: embeddingVersionMetadata(embeddingProvider),
  });
  const signalById = new Map(signals.map((signal) => [signal.id, signal]));
  const candidates = retrieved.map((result, index) => ({
    id: result.signal.id,
    text: candidateText(signalById.get(result.signal.id), result),
    originalRank: index + 1,
    retrievalScore: result.hybridScore,
  }));
  const candidatePreparationLatencyMs = Math.max(0, performance.now() - candidatePreparationStartedAt);

  const rerankingStartedAt = performance.now();
  try {
    const reranked = await rerankCandidates({
      query,
      candidates,
      topN: resultLimit,
      provider: rerankingProvider,
    });
    const resultById = new Map(retrieved.map((result) => [result.signal.id, result]));
    return {
      results: reranked.map((result) => {
        const retrievedResult = resultById.get(result.id);
        if (!retrievedResult) {
          throw new Error("Reranked result references a missing retrieval candidate.");
        }
        return {
          ...retrievedResult,
          originalRank: result.originalRank,
          rerankedRank: result.rerankedRank,
          rerankScore: result.rerankScore,
          reranked: true,
        };
      }),
      retrievalLatencyMs,
      candidatePreparationLatencyMs,
      rerankingLatencyMs: Math.max(0, performance.now() - rerankingStartedAt),
      totalLatencyMs: Math.max(0, performance.now() - totalStartedAt),
      rerankingStatus: "success",
      fallbackUsed: false,
      candidatesRetrieved: retrieved.length,
      provider: rerankingProvider.provider,
      model: rerankingProvider.model,
    };
  } catch (error) {
    return {
      results: fallbackResults(retrieved, resultLimit),
      retrievalLatencyMs,
      candidatePreparationLatencyMs,
      rerankingLatencyMs: Math.max(0, performance.now() - rerankingStartedAt),
      totalLatencyMs: Math.max(0, performance.now() - totalStartedAt),
      rerankingStatus: error instanceof RerankingProviderDisabledError ? "disabled" : "failed",
      fallbackUsed: true,
      candidatesRetrieved: retrieved.length,
      provider: rerankingProvider.provider,
      model: rerankingProvider.model,
      errorCode: errorCode(error),
    };
  }
}

export const RERANKED_SEARCH_LIMITS = {
  candidateLimit: DEFAULT_CANDIDATE_LIMIT,
  resultLimit: DEFAULT_RESULT_LIMIT,
} as const;
