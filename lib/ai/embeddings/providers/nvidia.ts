import { getNvidiaEmbeddingConfig, NVIDIA_EMBEDDING_PROFILE } from "../config";
import {
  EmbeddingConfigurationError,
  EmbeddingError,
  EmbeddingHttpError,
  EmbeddingProviderDisabledError,
  EmbeddingRateLimitError,
  EmbeddingTimeoutError,
  EmbeddingValidationError,
} from "../errors";
import { validateEmbeddingResults, validateEmbeddingVector } from "../validation";
import type { EmbeddingProvider, EmbeddingRequestOptions, EmbeddingResult } from "../types";

export const NVIDIA_EMBEDDING_PROVIDER_VERSION = "1.1.0";

type FetchLike = (
  input: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  }
) => Promise<Response>;

type FactoryOptions = {
  fetch?: FetchLike;
};

function requestUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, "")}/embeddings`;
}

function retryAfterMs(value: string | null) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 30000);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return Math.min(Math.max(date.getTime() - Date.now(), 0), 30000);
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function transientStatus(status: number) {
  return [408, 429, 500, 502, 503, 504].includes(status);
}

function delayMs(attempt: number, retryAfter: number | null) {
  return retryAfter ?? Math.min(250 * 2 ** attempt, 2000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEmbeddingResponse(value: unknown, dimensions: number, model: string) {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    throw new EmbeddingValidationError("Embedding response must include data array.");
  }
  if (value.model !== model) {
    throw new EmbeddingValidationError("Embedding response model does not match the request.");
  }

  const results: EmbeddingResult[] = [];
  for (const [fallbackIndex, item] of value.data.entries()) {
    if (!isRecord(item)) {
      throw new EmbeddingValidationError(`Embedding data item ${fallbackIndex} must be an object.`);
    }
    const index = typeof item.index === "number" ? item.index : fallbackIndex;
    results.push({
      index,
      embedding: validateEmbeddingVector(item.embedding, dimensions),
    });
  }

  return results.sort((a, b) => a.index - b.index);
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export function createNvidiaEmbeddingProvider(
  env: Record<string, string | undefined> = process.env,
  options: FactoryOptions = {}
): EmbeddingProvider {
  const config = getNvidiaEmbeddingConfig(env);
  const fetchImpl = options.fetch ?? fetch;

  return {
    provider: NVIDIA_EMBEDDING_PROFILE.provider,
    model: config.enabled ? config.model : "disabled",
    version: NVIDIA_EMBEDDING_PROVIDER_VERSION,
    dimensions: config.enabled ? config.dimensions : 0,
    maxBatchSize: config.batchSize,

    async embed(inputs: readonly string[], requestOptions: EmbeddingRequestOptions = {}) {
      if (!config.enabled) throw new EmbeddingProviderDisabledError();
      if (!config.apiKey) {
        throw new EmbeddingConfigurationError("NVIDIA embedding provider is misconfigured.");
      }
      if (inputs.length === 0) return [];
      if (inputs.length > config.batchSize) {
        throw new EmbeddingValidationError(
          `Embedding batch size exceeds ${config.batchSize}.`
        );
      }

      const timeoutMs = requestOptions.timeoutMs ?? config.timeoutMs;
      const maxRetries = requestOptions.maxRetries ?? config.maxRetries;
      const inputType = requestOptions.inputType ?? NVIDIA_EMBEDDING_PROFILE.documentInputType;
      let lastError: unknown = null;

      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetchImpl(requestUrl(config.baseUrl), {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: config.model,
              dimensions: config.dimensions,
              input: [...inputs],
              input_type: inputType,
              modality: "text",
              encoding_format: "float",
              truncate: NVIDIA_EMBEDDING_PROFILE.truncate,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (!response.ok) {
            const retryAfter = response.status === 429 ? retryAfterMs(response.headers.get("retry-after")) : null;
            const retryable = transientStatus(response.status);
            const error =
              response.status === 429
                ? new EmbeddingRateLimitError("NVIDIA embedding request was rate limited.", retryAfter)
                : new EmbeddingHttpError(
                    response.status,
                    `NVIDIA embedding request failed with HTTP ${response.status}.`,
                    retryable
                  );

            if (error.retryable && attempt < maxRetries) {
              await sleep(delayMs(attempt, retryAfter));
              continue;
            }
            throw error;
          }

          const json = (await response.json()) as unknown;
          const results = parseEmbeddingResponse(json, config.dimensions, config.model);
          return validateEmbeddingResults(results, inputs.length, config.dimensions);
        } catch (error) {
          clearTimeout(timeout);
          lastError = isAbortError(error) ? new EmbeddingTimeoutError() : error;
          const retryable =
            lastError instanceof EmbeddingError ? lastError.retryable : lastError instanceof Error;
          if (retryable && attempt < maxRetries) {
            const retryAfter =
              lastError instanceof EmbeddingRateLimitError ? lastError.retryAfterMs : null;
            await sleep(delayMs(attempt, retryAfter));
            continue;
          }
          throw lastError;
        }
      }

      throw lastError instanceof Error ? lastError : new EmbeddingTimeoutError();
    },
  };
}
