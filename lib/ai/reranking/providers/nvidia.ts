import {
  getNvidiaRerankingConfig,
  NVIDIA_RERANKING_LIMITS,
  NVIDIA_RERANKING_PROFILE,
} from "../config";
import {
  RerankingConfigurationError,
  RerankingError,
  RerankingHttpError,
  RerankingProviderDisabledError,
  RerankingRateLimitError,
  RerankingTimeoutError,
  RerankingValidationError,
} from "../errors";
import {
  normalizeRerankQuery,
  validateRerankCandidates,
  validateRerankResults,
  validateTopN,
} from "../validation";
import type { RerankCandidate, RerankRequestOptions, RerankResult, RerankingProvider } from "../types";

export const NVIDIA_RERANKING_PROVIDER_VERSION = "1.0.0";

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

function requestUrl(baseUrl: string, model: string) {
  return `${baseUrl.replace(/\/+$/, "")}/retrieval/${model}/reranking`;
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

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function boundedRequestInteger(
  value: number | undefined,
  fallback: number,
  name: string,
  minimum: number,
  maximum: number
) {
  if (value == null) return fallback;
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RerankingValidationError(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

function parseRerankingResponse(
  value: unknown,
  candidates: readonly RerankCandidate[],
  topN: number
) {
  if (!isRecord(value) || !Array.isArray(value.rankings)) {
    throw new RerankingValidationError("Reranking response must include rankings array.");
  }

  const candidateByIndex = new Map<number, RerankCandidate>();
  candidates.forEach((candidate, index) => {
    candidateByIndex.set(index, candidate);
  });

  const seenIndexes = new Set<number>();
  const results: Array<Omit<RerankResult, "rerankedRank">> = [];
  for (const [indexInResponse, item] of value.rankings.entries()) {
    if (!isRecord(item)) {
      throw new RerankingValidationError(`Reranking item ${indexInResponse} must be an object.`);
    }
    const index = typeof item.index === "number" ? item.index : null;
    const logit = typeof item.logit === "number" ? item.logit : null;
    if (!Number.isInteger(index) || index == null || !candidateByIndex.has(index)) {
      throw new RerankingValidationError("Reranking response contains an invalid candidate index.");
    }
    if (seenIndexes.has(index)) {
      throw new RerankingValidationError("Reranking response contains a duplicate candidate index.");
    }
    if (logit == null || !Number.isFinite(logit)) {
      throw new RerankingValidationError("Reranking response contains an invalid logit.");
    }

    const candidate = candidateByIndex.get(index);
    if (!candidate) {
      throw new RerankingValidationError("Reranking response references an unknown candidate.");
    }
    seenIndexes.add(index);
    results.push({
      id: candidate.id,
      originalRank: candidate.originalRank,
      rerankScore: logit,
    });
  }

  const ranked = results
    .sort(
      (a, b) =>
        b.rerankScore - a.rerankScore ||
        a.originalRank - b.originalRank ||
        a.id.localeCompare(b.id)
    )
    .slice(0, topN)
    .map((result, index) => ({ ...result, rerankedRank: index + 1 }));
  return validateRerankResults(ranked, candidates, topN);
}

export function createNvidiaRerankingProvider(
  env: Record<string, string | undefined> = process.env,
  options: FactoryOptions = {}
): RerankingProvider {
  const config = getNvidiaRerankingConfig(env);
  const fetchImpl = options.fetch ?? fetch;

  return {
    provider: NVIDIA_RERANKING_PROFILE.provider,
    model: config.enabled ? config.model : "disabled",
    version: NVIDIA_RERANKING_PROVIDER_VERSION,
    maxCandidates: config.candidateLimit,
    maxResults: config.resultLimit,

    async rerank(input, requestOptions: RerankRequestOptions = {}) {
      if (!config.enabled) throw new RerankingProviderDisabledError();
      if (!config.apiKey) {
        throw new RerankingConfigurationError("NVIDIA reranking provider is misconfigured.");
      }

      const query = normalizeRerankQuery(input.query);
      if (!query) return [];
      const candidates = validateRerankCandidates(input.candidates, config.candidateLimit);
      if (candidates.length === 0) return [];
      const topN = validateTopN(input.topN, candidates.length);
      const timeoutMs = boundedRequestInteger(
        requestOptions.timeoutMs,
        config.timeoutMs,
        "Reranking timeout",
        NVIDIA_RERANKING_LIMITS.minTimeoutMs,
        NVIDIA_RERANKING_LIMITS.maxTimeoutMs
      );
      const maxRetries = boundedRequestInteger(
        requestOptions.maxRetries,
        config.maxRetries,
        "Reranking maxRetries",
        0,
        NVIDIA_RERANKING_LIMITS.maxRetries
      );
      let lastError: unknown = null;

      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetchImpl(requestUrl(config.baseUrl, config.model), {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: config.model,
              query: { text: query },
              passages: candidates.map((candidate) => ({ text: candidate.text })),
              truncate: NVIDIA_RERANKING_PROFILE.truncate,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (!response.ok) {
            const retryAfter = response.status === 429 ? retryAfterMs(response.headers.get("retry-after")) : null;
            const retryable = transientStatus(response.status);
            const error =
              response.status === 429
                ? new RerankingRateLimitError("NVIDIA reranking request was rate limited.", retryAfter)
                : new RerankingHttpError(
                    response.status,
                    `NVIDIA reranking request failed with HTTP ${response.status}.`,
                    retryable
                  );

            if (error.retryable && attempt < maxRetries) {
              await sleep(delayMs(attempt, retryAfter));
              continue;
            }
            throw error;
          }

          let json: unknown;
          try {
            json = await response.json();
          } catch {
            throw new RerankingValidationError("NVIDIA reranking response was not valid JSON.");
          }
          return parseRerankingResponse(json, candidates, topN);
        } catch (error) {
          clearTimeout(timeout);
          lastError = isAbortError(error) ? new RerankingTimeoutError() : error;
          const retryable =
            lastError instanceof RerankingError ? lastError.retryable : lastError instanceof Error;
          if (retryable && attempt < maxRetries) {
            const retryAfter =
              lastError instanceof RerankingRateLimitError ? lastError.retryAfterMs : null;
            await sleep(delayMs(attempt, retryAfter));
            continue;
          }
          throw lastError;
        }
      }

      throw lastError instanceof Error ? lastError : new RerankingTimeoutError();
    },
  };
}
