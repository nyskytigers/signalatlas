import { createNvidiaEmbeddingProvider } from "./providers/nvidia";
import { createPrismaEmbeddingRepository } from "./repository";
import { embeddingVersionMetadata } from "./service";
import { validateEmbeddingResults } from "./validation";
import { NVIDIA_EMBEDDING_PROFILE } from "./config";
import type {
  EmbeddingProvider,
  EmbeddingRepository,
  SemanticSearchFilters,
  SemanticSignalSearchResult,
} from "./types";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_QUERY_LENGTH = 500;

function normalizeQuery(query: string) {
  return query.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

function boundedLimit(limit: number | undefined) {
  if (limit == null) return DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

export async function searchSignalsByEmbedding(args: {
  query: string;
  limit?: number;
  filters?: SemanticSearchFilters;
  provider?: EmbeddingProvider;
  repository?: EmbeddingRepository;
}): Promise<readonly SemanticSignalSearchResult[]> {
  const query = normalizeQuery(args.query);
  if (!query) return [];

  const provider = args.provider ?? createNvidiaEmbeddingProvider();
  const repository = args.repository ?? createPrismaEmbeddingRepository();
  const [result] = validateEmbeddingResults(
    await provider.embed([query], { inputType: NVIDIA_EMBEDDING_PROFILE.queryInputType }),
    1,
    provider.dimensions
  );
  return repository.searchByVector({
    vector: result.embedding,
    version: embeddingVersionMetadata(provider),
    limit: boundedLimit(args.limit),
    filters: args.filters,
  });
}

export const SEMANTIC_SEARCH_LIMITS = {
  defaultLimit: DEFAULT_LIMIT,
  maxLimit: MAX_LIMIT,
  maxQueryLength: MAX_QUERY_LENGTH,
} as const;
