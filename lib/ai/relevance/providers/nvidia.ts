import { buildNvidiaRelevancePrompt, NVIDIA_RELEVANCE_PROMPT_VERSION } from "../prompt";
import { normalizeAssessmentInput } from "../normalize";
import { validateProviderJsonText } from "../schema";
import type {
  ProviderAssessmentWithMetadata,
  RelevanceAssessmentInput,
  RelevanceAssessmentProvider,
  RelevanceAssessmentRequestOptions,
} from "../types";
import {
  NvidiaConfigurationError,
  NvidiaHttpError,
  NvidiaProviderDisabledError,
  NvidiaProviderError,
  NvidiaRateLimitError,
  NvidiaTimeoutError,
} from "../errors";

export const NVIDIA_RELEVANCE_PROVIDER_VERSION = "1.0.0";

type FetchLike = (
  input: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  }
) => Promise<Response>;

type NvidiaProviderConfig = {
  enabled: boolean;
  apiKey: string | null;
  model: string | null;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
};

type NvidiaProviderFactoryOptions = {
  fetch?: FetchLike;
};

function parseBoolean(value: string | undefined) {
  return value === "true";
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
  options: { allowZero?: boolean } = {}
) {
  if (value == null || value.trim() === "") return fallback;

  const parsed = Number(value);
  const minimum = options.allowZero ? 0 : 1;
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new NvidiaConfigurationError(`${name} must be an integer >= ${minimum}.`);
  }

  return parsed;
}

export function getNvidiaRelevanceConfig(
  env: Record<string, string | undefined> = process.env
): NvidiaProviderConfig {
  const enabled = parseBoolean(env.NVIDIA_RELEVANCE_ENABLED);
  const config = {
    enabled,
    apiKey: env.NVIDIA_API_KEY?.trim() || null,
    model: env.NVIDIA_RELEVANCE_MODEL?.trim() || null,
    baseUrl: env.NVIDIA_RELEVANCE_BASE_URL?.trim() || "https://integrate.api.nvidia.com/v1",
    timeoutMs: parsePositiveInteger(env.NVIDIA_RELEVANCE_TIMEOUT_MS, 30000, "NVIDIA_RELEVANCE_TIMEOUT_MS"),
    maxRetries: parsePositiveInteger(env.NVIDIA_RELEVANCE_MAX_RETRIES, 2, "NVIDIA_RELEVANCE_MAX_RETRIES", {
      allowZero: true,
    }),
  };

  if (!config.enabled) return config;
  if (!config.apiKey) throw new NvidiaConfigurationError("NVIDIA_API_KEY is required when NVIDIA relevance is enabled.");
  if (!config.model) {
    throw new NvidiaConfigurationError(
      "NVIDIA_RELEVANCE_MODEL is required when NVIDIA relevance is enabled."
    );
  }

  return config;
}

function retryAfterMs(value: string | null) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 30000);

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return Math.min(Math.max(date.getTime() - Date.now(), 0), 30000);
}

function transientStatus(status: number) {
  return [408, 429, 500, 502, 503, 504].includes(status);
}

function delayMs(attempt: number, retryAfter: number | null) {
  if (retryAfter != null) return retryAfter;
  return Math.min(250 * 2 ** attempt, 2000);
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textFromCompletionResponse(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.choices)) return null;
  const choice = value.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message)) return null;
  const content = choice.message.content;
  return typeof content === "string" ? content : null;
}

function tokenUsageFrom(value: unknown) {
  if (!isRecord(value) || !isRecord(value.usage)) return undefined;

  return {
    promptTokens:
      typeof value.usage.prompt_tokens === "number" ? value.usage.prompt_tokens : undefined,
    completionTokens:
      typeof value.usage.completion_tokens === "number"
        ? value.usage.completion_tokens
        : undefined,
    totalTokens: typeof value.usage.total_tokens === "number" ? value.usage.total_tokens : undefined,
  };
}

function requestUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

export function createNvidiaRelevanceProvider(
  env: Record<string, string | undefined> = process.env,
  options: NvidiaProviderFactoryOptions = {}
): RelevanceAssessmentProvider {
  const config = getNvidiaRelevanceConfig(env);
  const fetchImpl = options.fetch ?? fetch;

  return {
    provider: "nvidia",
    model: config.model ?? "disabled",
    version: NVIDIA_RELEVANCE_PROVIDER_VERSION,

    async assess(
      input: RelevanceAssessmentInput,
      requestOptions: RelevanceAssessmentRequestOptions = {}
    ): Promise<ProviderAssessmentWithMetadata> {
      if (!config.enabled) throw new NvidiaProviderDisabledError();
      if (!config.apiKey || !config.model) {
        throw new NvidiaConfigurationError("NVIDIA relevance provider is misconfigured.");
      }

      const normalizedInput = normalizeAssessmentInput(input);
      const prompt = buildNvidiaRelevancePrompt(normalizedInput);
      const timeoutMs = requestOptions.timeoutMs ?? config.timeoutMs;
      const maxRetries = requestOptions.maxRetries ?? config.maxRetries;
      const startedAt = Date.now();
      let retryCount = 0;
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
              messages: [
                {
                  role: "user",
                  content: prompt,
                },
              ],
              temperature: 0,
              max_tokens: 1600,
              response_format: { type: "json_object" },
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (!response.ok) {
            const retryAfter = response.status === 429 ? retryAfterMs(response.headers.get("retry-after")) : null;
            const retryable = transientStatus(response.status);
            const error =
              response.status === 429
                ? new NvidiaRateLimitError("NVIDIA relevance request was rate limited.", retryAfter)
                : new NvidiaHttpError(
                    response.status,
                    `NVIDIA relevance request failed with HTTP ${response.status}.`,
                    retryable
                  );

            if (retryable && attempt < maxRetries) {
              retryCount += 1;
              await sleep(delayMs(attempt, retryAfter));
              continue;
            }

            throw error;
          }

          const responseJson = (await response.json()) as unknown;
          const content = textFromCompletionResponse(responseJson);
          if (!content) {
            throw new NvidiaHttpError(200, "NVIDIA response did not include message content.", false);
          }

          const validated = validateProviderJsonText(content);
          return {
            assessment: {
              ...validated.assessment,
              model: config.model,
              providerVersion: NVIDIA_RELEVANCE_PROVIDER_VERSION,
              promptVersion: NVIDIA_RELEVANCE_PROMPT_VERSION,
            },
            rawResponse: requestOptions.storeRawResponse ? responseJson : null,
            requestMetadata: {
              durationMs: Date.now() - startedAt,
              retryCount,
              providerRequestId:
                response.headers.get("x-request-id") ??
                response.headers.get("nvcf-reqid") ??
                undefined,
              tokenUsage: tokenUsageFrom(responseJson),
            },
          };
        } catch (error) {
          clearTimeout(timeout);
          lastError = isAbortError(error) ? new NvidiaTimeoutError() : error;

          const retryable =
            lastError instanceof NvidiaProviderError
              ? lastError.retryable
              : lastError instanceof Error;

          if (
            (lastError instanceof NvidiaRateLimitError ||
              (lastError instanceof NvidiaHttpError && lastError.retryable) ||
              retryable) &&
            attempt < maxRetries
          ) {
            retryCount += 1;
            const retryAfter =
              lastError instanceof NvidiaRateLimitError ? lastError.retryAfterMs : null;
            await sleep(delayMs(attempt, retryAfter));
            continue;
          }

          throw lastError;
        }
      }

      throw lastError instanceof Error
        ? lastError
        : new NvidiaTimeoutError("NVIDIA relevance request retry budget was exhausted.");
    },
  };
}
