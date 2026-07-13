export class EmbeddingError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.retryable = retryable;
  }
}

export class EmbeddingProviderDisabledError extends EmbeddingError {
  constructor() {
    super("provider_disabled", "Embedding provider is disabled.", false);
  }
}

export class EmbeddingConfigurationError extends EmbeddingError {
  constructor(message: string) {
    super("configuration_error", message, false);
  }
}

export class EmbeddingTimeoutError extends EmbeddingError {
  constructor(message = "Embedding request timed out.") {
    super("timeout", message, true);
  }
}

export class EmbeddingRateLimitError extends EmbeddingError {
  readonly retryAfterMs: number | null;

  constructor(message = "Embedding request was rate limited.", retryAfterMs: number | null = null) {
    super("rate_limited", message, true);
    this.retryAfterMs = retryAfterMs;
  }
}

export class EmbeddingHttpError extends EmbeddingError {
  readonly status: number;

  constructor(status: number, message: string, retryable: boolean) {
    super("http_error", message, retryable);
    this.status = status;
  }
}

export class EmbeddingValidationError extends EmbeddingError {
  constructor(message: string) {
    super("validation_error", message, false);
  }
}
