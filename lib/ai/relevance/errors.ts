export class NvidiaProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.retryable = retryable;
  }
}

export class NvidiaConfigurationError extends NvidiaProviderError {
  constructor(message: string) {
    super("configuration_error", message, false);
  }
}

export class NvidiaProviderDisabledError extends NvidiaProviderError {
  constructor() {
    super("provider_disabled", "NVIDIA relevance provider is disabled.", false);
  }
}

export class NvidiaTimeoutError extends NvidiaProviderError {
  constructor(message = "NVIDIA relevance request timed out.") {
    super("timeout", message, true);
  }
}

export class NvidiaRateLimitError extends NvidiaProviderError {
  readonly retryAfterMs: number | null;

  constructor(message = "NVIDIA relevance request was rate limited.", retryAfterMs: number | null = null) {
    super("rate_limited", message, true);
    this.retryAfterMs = retryAfterMs;
  }
}

export class NvidiaHttpError extends NvidiaProviderError {
  readonly status: number;

  constructor(status: number, message: string, retryable: boolean) {
    super("http_error", message, retryable);
    this.status = status;
  }
}

export class NvidiaInvalidResponseError extends NvidiaProviderError {
  constructor(message: string) {
    super("invalid_response", message, false);
  }
}

export class NvidiaSchemaValidationError extends NvidiaProviderError {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super("schema_validation_error", `NVIDIA response failed schema validation: ${issues.join("; ")}`, false);
    this.issues = [...issues];
  }
}
