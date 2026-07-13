import { createNvidiaEmbeddingProvider } from "./providers/nvidia";
import { createPrismaEmbeddingRepository } from "./repository";
import { searchSignalsByEmbedding } from "./search";
import type {
  EmbeddingProvider,
  EmbeddingRepository,
  HybridSignalSearchResult,
  SemanticSearchFilters,
} from "./types";

const DEFAULT_SEMANTIC_WEIGHT = 0.65;
const DEFAULT_KEYWORD_WEIGHT = 0.35;
const WEIGHT_TOLERANCE = 0.000001;

function validateWeights(semanticWeight = DEFAULT_SEMANTIC_WEIGHT, keywordWeight = DEFAULT_KEYWORD_WEIGHT) {
  if (
    !Number.isFinite(semanticWeight) ||
    !Number.isFinite(keywordWeight) ||
    semanticWeight < 0 ||
    keywordWeight < 0 ||
    Math.abs(semanticWeight + keywordWeight - 1) > WEIGHT_TOLERANCE
  ) {
    throw new Error("Hybrid search weights must be finite, non-negative, and total 1.");
  }
  return { semanticWeight, keywordWeight };
}

function normalizeKeyword(score: number, maxScore: number) {
  if (!Number.isFinite(score) || maxScore <= 0) return 0;
  return Math.min(Math.max(score / maxScore, 0), 1);
}

export async function searchSignalsHybrid(args: {
  query: string;
  limit?: number;
  semanticWeight?: number;
  keywordWeight?: number;
  filters?: SemanticSearchFilters;
  provider?: EmbeddingProvider;
  repository?: EmbeddingRepository;
}): Promise<readonly HybridSignalSearchResult[]> {
  const weights = validateWeights(args.semanticWeight, args.keywordWeight);
  const provider = args.provider ?? createNvidiaEmbeddingProvider();
  const repository = args.repository ?? createPrismaEmbeddingRepository();
  const limit = args.limit ?? 10;
  const [semanticResults, keywordResults] = await Promise.all([
    searchSignalsByEmbedding({
      query: args.query,
      limit,
      filters: args.filters,
      provider,
      repository,
    }).catch(() => []),
    repository.searchKeyword({
      query: args.query,
      limit,
      filters: args.filters,
    }),
  ]);
  const maxKeywordScore = Math.max(0, ...keywordResults.map((result) => result.score));
  const merged = new Map<string, HybridSignalSearchResult>();

  for (const result of semanticResults) {
    const semanticScore = Math.min(Math.max(result.similarity, 0), 1);
    merged.set(result.signalId, {
      signal: {
        id: result.signalId,
        title: result.title,
        url: result.url,
        signalType: result.signalType,
      },
      hybridScore: semanticScore * weights.semanticWeight,
      semanticScore,
      keywordScore: 0,
      matchedBy: ["semantic"],
      provider: result.provider,
      model: result.model,
      embeddingVersion: result.embeddingVersion,
    });
  }

  for (const result of keywordResults) {
    const keywordScore = normalizeKeyword(result.score, maxKeywordScore);
    const existing = merged.get(result.signalId);
    if (existing) {
      merged.set(result.signalId, {
        ...existing,
        keywordScore,
        hybridScore:
          existing.semanticScore * weights.semanticWeight + keywordScore * weights.keywordWeight,
        matchedBy: ["semantic", "keyword"],
      });
    } else {
      merged.set(result.signalId, {
        signal: {
          id: result.signalId,
          title: result.title,
          url: result.url,
          signalType: result.signalType,
        },
        hybridScore: keywordScore * weights.keywordWeight,
        semanticScore: 0,
        keywordScore,
        matchedBy: ["keyword"],
      });
    }
  }

  return Array.from(merged.values())
    .sort(
      (a, b) =>
        b.hybridScore - a.hybridScore ||
        b.semanticScore - a.semanticScore ||
        a.signal.id.localeCompare(b.signal.id)
    )
    .slice(0, limit);
}

export const HYBRID_SEARCH_DEFAULTS = {
  semanticWeight: DEFAULT_SEMANTIC_WEIGHT,
  keywordWeight: DEFAULT_KEYWORD_WEIGHT,
} as const;
