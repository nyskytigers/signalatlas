# NVIDIA Relevance Provider

Milestone 4.2 adds an optional NVIDIA-backed relevance assessment provider. It does not replace deterministic relevance scoring. Deterministic scoring remains local, pure, and always usable.

## Purpose

The NVIDIA provider can propose research domains, technologies, six dimension scores, explanations, and confidence. SignalAtlas validates that output strictly, canonicalizes technologies, normalizes confidence, calculates the final score itself, and stores an append-only audit record.

## Architecture

Code lives under `lib/ai/relevance`.

- `types.ts` defines provider-neutral input, output, persistence, and service types.
- `prompt.ts` builds the versioned NVIDIA prompt.
- `schema.ts` validates untrusted provider JSON at runtime.
- `normalize.ts` bounds provider input, canonicalizes provider output, calculates confidence, final score, and band.
- `providers/nvidia.ts` handles NVIDIA configuration, HTTP calls, timeouts, and retries.
- `service.ts` loads Signals and persists success or failure records.
- `scripts/relevance-nvidia.ts` provides manual reprocessing.

No provider is called at import time, build time, page render time, or ingest time.

## Environment Variables

The provider is disabled unless explicitly enabled.

```text
NVIDIA_RELEVANCE_ENABLED=false
NVIDIA_API_KEY=
NVIDIA_RELEVANCE_MODEL=
NVIDIA_RELEVANCE_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_RELEVANCE_TIMEOUT_MS=30000
NVIDIA_RELEVANCE_MAX_RETRIES=2
```

`NVIDIA_API_KEY` is server-only and must never be exposed to client components.

## Prompt Versioning

`NVIDIA_RELEVANCE_PROMPT_VERSION` is `1.0.0`. The prompt includes the six Milestone 4.1 dimensions, requires JSON only, tells the model not to invent missing evidence, and warns that generic AI, VR, robotics, or computer vision is not automatically highly relevant.

## Response Schema

The provider must return:

- provider/model/version metadata,
- canonical domains where possible,
- technologies that can resolve through shared Signal technology helpers,
- all six dimension scores from 0 to 100,
- confidence from 0 to 1,
- summary explanation,
- dimension explanations,
- warnings.

Unknown top-level fields are rejected. Missing dimensions, invalid numbers, out-of-range scores, and invalid JSON fail validation. Markdown-wrapped JSON is handled by an explicit bounded extractor.

## Application-Owned Scoring

The model does not provide the final score. SignalAtlas calculates:

```ts
Math.round(
  researchRelevance * 0.3 +
    novelty * 0.2 +
    technologyImpact * 0.2 +
    portfolioUsefulness * 0.15 +
    graduateValue * 0.1 +
    communityAttention * 0.05
)
```

The rounded integer drives the score band.

## Confidence Normalization

SignalAtlas stores both provider confidence and normalized confidence.

```text
normalizedConfidence =
  providerConfidence *
  validationFactor *
  recognitionFactor *
  explanationFactor *
  warningFactor
```

The result is clamped to 0-1. Recognition is reduced when domains or technologies are not recognized. Explanation completeness and warnings also reduce confidence.

## Retries And Timeouts

The NVIDIA client uses `AbortController` for timeout enforcement. It retries only:

- timeout,
- HTTP 408,
- HTTP 429,
- HTTP 500,
- HTTP 502,
- HTTP 503,
- HTTP 504,
- temporary network failures.

It does not retry disabled provider errors, missing configuration, HTTP 400/401/403, malformed successful JSON, or schema-invalid successful responses.

## Persistence

Assessments are stored in `SignalRelevanceAssessment`. Records are append-only and preserve history. Success and failure records include provider, model, prompt version, scoring version, dimensions, domains, technologies, confidence, final score, band, warnings, request metadata, and optional raw response data.

API keys and request headers are never stored.

## Manual Reprocessing

Run one Signal by ID:

```bash
npm run relevance:nvidia -- --signal-id <id>
```

Dry run prints the bounded normalized request and does not call NVIDIA:

```bash
npm run relevance:nvidia -- --signal-id <id> --dry-run
```

Raw response storage is opt-in:

```bash
npm run relevance:nvidia -- --signal-id <id> --store-raw-response
```

## Failure Behavior

If NVIDIA fails, deterministic relevance remains usable, ingestion is unaffected, existing Signals remain valid, and no page should crash. Manual commands return a clear non-zero failure message. The service stores a failure assessment for auditing when the Signal exists.

## Security And Cost Controls

- Disabled by default.
- Manual execution only.
- Bounded input and output.
- Explicit model configuration.
- Timeout and retry cap.
- No client-side calls.
- No build-time calls.
- No automatic batch or ingest integration.
- Optional raw-response storage.
- Request metadata excludes secrets and headers.

## Excluded From 4.2

This milestone does not implement embeddings, semantic search, reranking, GPT comparison, admin comparison UI, automatic ingestion-time NVIDIA calls, or formal cost accounting.
