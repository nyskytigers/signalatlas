import { EmbeddingConfigurationError } from "./errors";

export const NVIDIA_EMBEDDING_PROFILE = {
  provider: "nvidia",
  model: "nvidia/llama-nemotron-embed-1b-v2",
  dimensions: 1024,
  documentInputType: "passage",
  queryInputType: "query",
  maxInputTokens: 8192,
  truncate: "END",
  distanceMetric: "cosine",
} as const;

export type NvidiaEmbeddingConfig = {
  enabled: boolean;
  apiKey: string | null;
  model: string;
  baseUrl: string;
  dimensions: number;
  timeoutMs: number;
  maxRetries: number;
  batchSize: number;
};

function positiveInteger(
  value: string | undefined,
  fallback: number | null,
  name: string,
  options: { allowZero?: boolean; max?: number } = {}
) {
  if (value == null || value.trim() === "") {
    if (fallback == null) return null;
    return fallback;
  }

  const parsed = Number(value);
  const minimum = options.allowZero ? 0 : 1;
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new EmbeddingConfigurationError(`${name} must be an integer >= ${minimum}.`);
  }
  if (options.max != null && parsed > options.max) {
    throw new EmbeddingConfigurationError(`${name} must be <= ${options.max}.`);
  }

  return parsed;
}

export function getNvidiaEmbeddingConfig(
  env: Record<string, string | undefined> = process.env
): NvidiaEmbeddingConfig {
  const enabled = env.NVIDIA_EMBEDDING_ENABLED === "true";
  const config: NvidiaEmbeddingConfig = {
    enabled,
    apiKey: env.NVIDIA_EMBEDDING_API_KEY?.trim() || env.NVIDIA_API_KEY?.trim() || null,
    model: env.NVIDIA_EMBEDDING_MODEL?.trim() || NVIDIA_EMBEDDING_PROFILE.model,
    baseUrl: env.NVIDIA_EMBEDDING_BASE_URL?.trim() || "https://integrate.api.nvidia.com/v1",
    dimensions: positiveInteger(
      env.NVIDIA_EMBEDDING_DIMENSIONS,
      NVIDIA_EMBEDDING_PROFILE.dimensions,
      "NVIDIA_EMBEDDING_DIMENSIONS"
    ) ?? NVIDIA_EMBEDDING_PROFILE.dimensions,
    timeoutMs: positiveInteger(
      env.NVIDIA_EMBEDDING_TIMEOUT_MS,
      30000,
      "NVIDIA_EMBEDDING_TIMEOUT_MS"
    ) ?? 30000,
    maxRetries: positiveInteger(
      env.NVIDIA_EMBEDDING_MAX_RETRIES,
      2,
      "NVIDIA_EMBEDDING_MAX_RETRIES",
      { allowZero: true }
    ) ?? 2,
    batchSize: positiveInteger(
      env.NVIDIA_EMBEDDING_BATCH_SIZE,
      16,
      "NVIDIA_EMBEDDING_BATCH_SIZE",
      { max: 64 }
    ) ?? 16,
  };

  if (config.model !== NVIDIA_EMBEDDING_PROFILE.model) {
    throw new EmbeddingConfigurationError(
      `NVIDIA_EMBEDDING_MODEL must be ${NVIDIA_EMBEDDING_PROFILE.model}.`
    );
  }
  if (config.dimensions !== NVIDIA_EMBEDDING_PROFILE.dimensions) {
    throw new EmbeddingConfigurationError(
      `NVIDIA_EMBEDDING_DIMENSIONS must be ${NVIDIA_EMBEDDING_PROFILE.dimensions}.`
    );
  }
  if (!enabled) return config;
  if (!config.apiKey) throw new EmbeddingConfigurationError("NVIDIA embedding API key is required.");

  return config;
}
