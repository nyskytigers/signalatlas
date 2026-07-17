export class RerankingError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.retryable = retryable;
  }
}

export class RerankingProviderDisabledError extends RerankingError {
  constructor() {
    super("provider_disabled", "Reranking provider is disabled.", false);
  }
}

export class RerankingConfigurationError extends RerankingError {
  constructor(message: string) {
    super("configuration_error", message, false);
  }
}

export class RerankingTimeoutError extends RerankingError {
  constructor(message = "Reranking request timed out.") {
    super("timeout", message, true);
  }
}

export class RerankingRateLimitError extends RerankingError {
  readonly retryAfterMs: number | null;

  constructor(message = "Reranking request was rate limited.", retryAfterMs: number | null = null) {
    super("rate_limited", message, true);
    this.retryAfterMs = retryAfterMs;
  }
}

export class RerankingHttpError extends RerankingError {
  readonly status: number;

  constructor(status: number, message: string, retryable: boolean) {
    super("http_error", message, retryable);
    this.status = status;
  }
}

export class RerankingValidationError extends RerankingError {
  constructor(message: string) {
    super("validation_error", message, false);
  }
}
