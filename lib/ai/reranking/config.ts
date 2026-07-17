import { RerankingConfigurationError } from "./errors";

export const NVIDIA_RERANKING_PROFILE = {
  provider: "nvidia",
  model: "nvidia/llama-nemotron-rerank-1b-v2",
  endpointBaseUrl: "https://ai.api.nvidia.com/v1",
  maxInputTokens: 8192,
  maxApiPassages: 1000,
  candidateLimit: 30,
  resultLimit: 10,
  truncate: "END",
  scoreType: "logit",
} as const;

export const NVIDIA_RERANKING_LIMITS = {
  minTimeoutMs: 100,
  maxTimeoutMs: 120000,
  maxRetries: 5,
} as const;

export type NvidiaRerankingConfig = {
  enabled: boolean;
  apiKey: string | null;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  candidateLimit: number;
  resultLimit: number;
};

function positiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
  options: { allowZero?: boolean; min?: number; max?: number } = {}
) {
  if (value == null || value.trim() === "") return fallback;

  const parsed = Number(value);
  const minimum = options.min ?? (options.allowZero ? 0 : 1);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new RerankingConfigurationError(`${name} must be an integer >= ${minimum}.`);
  }
  if (options.max != null && parsed > options.max) {
    throw new RerankingConfigurationError(`${name} must be <= ${options.max}.`);
  }

  return parsed;
}

export function getNvidiaRerankingConfig(
  env: Record<string, string | undefined> = process.env
): NvidiaRerankingConfig {
  const enabled = env.NVIDIA_RERANKING_ENABLED === "true";
  const config: NvidiaRerankingConfig = {
    enabled,
    apiKey: env.NVIDIA_RERANKING_API_KEY?.trim() || env.NVIDIA_API_KEY?.trim() || null,
    model: env.NVIDIA_RERANKING_MODEL?.trim() || NVIDIA_RERANKING_PROFILE.model,
    baseUrl: env.NVIDIA_RERANKING_BASE_URL?.trim() || NVIDIA_RERANKING_PROFILE.endpointBaseUrl,
    timeoutMs: positiveInteger(
      env.NVIDIA_RERANKING_TIMEOUT_MS,
      30000,
      "NVIDIA_RERANKING_TIMEOUT_MS",
      { min: NVIDIA_RERANKING_LIMITS.minTimeoutMs, max: NVIDIA_RERANKING_LIMITS.maxTimeoutMs }
    ),
    maxRetries: positiveInteger(
      env.NVIDIA_RERANKING_MAX_RETRIES,
      2,
      "NVIDIA_RERANKING_MAX_RETRIES",
      { allowZero: true, max: NVIDIA_RERANKING_LIMITS.maxRetries }
    ),
    candidateLimit: positiveInteger(
      env.NVIDIA_RERANKING_CANDIDATE_LIMIT,
      NVIDIA_RERANKING_PROFILE.candidateLimit,
      "NVIDIA_RERANKING_CANDIDATE_LIMIT",
      { max: NVIDIA_RERANKING_PROFILE.candidateLimit }
    ),
    resultLimit: positiveInteger(
      env.NVIDIA_RERANKING_RESULT_LIMIT,
      NVIDIA_RERANKING_PROFILE.resultLimit,
      "NVIDIA_RERANKING_RESULT_LIMIT",
      { max: NVIDIA_RERANKING_PROFILE.resultLimit }
    ),
  };

  if (config.model !== NVIDIA_RERANKING_PROFILE.model) {
    throw new RerankingConfigurationError(
      `NVIDIA_RERANKING_MODEL must be ${NVIDIA_RERANKING_PROFILE.model}.`
    );
  }
  if (config.resultLimit > config.candidateLimit) {
    throw new RerankingConfigurationError(
      "NVIDIA_RERANKING_RESULT_LIMIT must be <= NVIDIA_RERANKING_CANDIDATE_LIMIT."
    );
  }
  if (!enabled) return config;
  if (!config.apiKey) throw new RerankingConfigurationError("NVIDIA reranking API key is required.");

  return config;
}
