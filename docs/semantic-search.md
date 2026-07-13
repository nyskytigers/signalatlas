# Semantic Search

Milestone 4.3 adds versioned embeddings and retrieval-only semantic search for Signals. It does not add generated answers, chat, reranking, GPT evaluation, or automatic API spending.

## Architecture

Code lives in `lib/ai/embeddings`.

- `input.ts` builds deterministic Signal embedding text and hashes it.
- `providers/nvidia.ts` implements the first embedding provider.
- `repository.ts` stores embeddings and performs parameterized pgvector search.
- `service.ts` embeds Signals and supports backfill/incremental helpers.
- `search.ts` runs semantic vector retrieval.
- `hybrid.ts` combines semantic and keyword retrieval.

## pgvector Setup

The migration `20260713000000_add_signal_embeddings` runs:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

It creates `SignalEmbedding` with a nullable `vector(1024)` column so failure records can be stored without vectors while PostgreSQL enforces the selected model dimension.

## Model Profile

Milestone 4.3 uses one runtime profile exported as `NVIDIA_EMBEDDING_PROFILE`:

```text
provider: nvidia
model: nvidia/llama-nemotron-embed-1b-v2
dimensions: 1024
document input type: passage
query input type: query
maximum input: 8192 tokens
truncation: END
distance metric: cosine
```

NVIDIA requires `passage` for indexed documents and `query` for searches. Requests use float output, explicit text modality, an explicit 1024-dimensional Matryoshka output, and end truncation. Provider responses must identify the requested model and contain exactly 1024 finite values. The persistence and search boundaries validate dimensions again before constructing pgvector SQL.

Hosted API verification returned approximately unit-length vectors for both input types, but the application does not depend on provider normalization. It stores finite vectors as returned and uses pgvector cosine distance, which remains correct if provider scaling changes.

The original candidate, `nvidia/nv-embedqa-e5-v5`, was live-verified at 1024 dimensions but not selected because NVIDIA has announced its deprecation for November 2026. The selected Llama Nemotron model is available through the same hosted endpoint, supports 8192-token inputs, and returned 1024-dimensional query and passage embeddings when that documented output size was requested.

## Environment Variables

```text
NVIDIA_EMBEDDING_ENABLED=false
NVIDIA_EMBEDDING_API_KEY=
NVIDIA_EMBEDDING_MODEL=nvidia/llama-nemotron-embed-1b-v2
NVIDIA_EMBEDDING_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_EMBEDDING_DIMENSIONS=1024
NVIDIA_EMBEDDING_TIMEOUT_MS=30000
NVIDIA_EMBEDDING_MAX_RETRIES=2
NVIDIA_EMBEDDING_BATCH_SIZE=16
```

`NVIDIA_API_KEY` is used as a fallback only when `NVIDIA_EMBEDDING_API_KEY` is empty. Model and dimension environment values are checked against the authoritative runtime profile so application validation cannot drift from the pending migration.

## Embedding Input Format

`buildSignalEmbeddingText(signal)` creates labeled, deterministic sections:

```text
Title: ...
Type: PAPER
Summary: ...
Domains: ...
Technologies: ...
Organizations: ...
Researchers: ...
Projects: ...
Vessels: ...
Expeditions: ...
Sites: ...
Keywords: ...
Source: ...
Host: example.com
```

Arrays are de-duplicated, sorted with a locale-independent comparator, and bounded. Keywords are limited to 40 normalized values of at most 120 characters; HTML tags and obvious JSON blobs are excluded. Whitespace is normalized. Raw metadata, timestamps, API keys, and relevance scores are excluded. Long fields and total text length are truncated deterministically.

The full canonical URL is not embedded. Only its lower-cased hostname is included, with a leading `www.` removed. URL paths, query parameters, fragments, credentials, signatures, and tracking tokens therefore cannot change or leak into embedding text.

## Versioning And Hashing

`SIGNAL_EMBEDDING_INPUT_VERSION` is `1.1.0`. Embedding version includes provider, model, provider version, input version, and dimensions. `hashSignalEmbeddingText(text)` produces a stable SHA-256 content hash.

## Persistence

One compatible row exists per Signal/provider/model/embeddingVersion. If source text is unchanged, embedding is skipped. If forced or changed, the compatible row is refreshed. Incompatible versions remain distinguishable.

New failure rows store a bounded, sanitized error code/message and no vector. If a compatible successful row already exists, a failed refresh preserves its status, hashes, and vector while recording the latest sanitized failure under `metadataJson.lastFailure`. A later successful retry replaces a failed row and clears its failure fields.

## Backfill

```bash
npm run embeddings:backfill -- --limit 25
npm run embeddings:backfill -- --signal-id <id>
npm run embeddings:backfill -- --limit 25 --only-missing
npm run embeddings:backfill -- --signal-id <id> --force
npm run embeddings:backfill -- --limit 10 --dry-run
```

No unlimited run is provided by default.

## Incremental Helper

`embedSignalIfNeeded(signalId)` is safe for future ingest integration. It skips unchanged content, returns disabled/failure states without throwing by default, and is not wired into ingest in this milestone.

## Semantic Search

`searchSignalsByEmbedding({ query, limit, filters })` embeds the query with `input_type=query`, searches compatible successful vectors only, computes cosine similarity using pgvector, and returns ranked Signals. Signal backfill uses `input_type=passage`.

Supported filters:

- signal type
- domain
- technology
- source name
- publication date range

## Hybrid Retrieval

`searchSignalsHybrid` combines semantic and keyword scores:

```text
hybridScore = semanticScore * 0.65 + keywordScore * 0.35
```

Custom weights must be finite, non-negative, and total 1 within tolerance. Component scores and match sources are returned.

## Search Command

```bash
npm run signals:semantic-search -- --query "underwater SLAM using NeRF"
npm run signals:semantic-search -- --query "XR shipwreck documentation" --mode hybrid --limit 10
npm run signals:semantic-search -- --query "underwater SLAM" --type PAPER --technology SLAM
```

Output includes rank, title, scores, Signal ID, URL, model, and embedding version. Raw vectors are never printed.

## Migration Safety

Because migration history cannot replay cleanly into a shadow database, this milestone did not use `prisma migrate dev`. The migration SQL was written manually and should be reviewed before deployment. Verification uses `npx prisma validate`, `npx prisma generate`, and `npx prisma migrate status`. Apply with `npx prisma migrate deploy` only after review and only against the intended development database.

## Security And Cost Controls

- Disabled by default.
- Manual commands only.
- Bounded batch size.
- Bounded query length.
- Bounded result limits.
- Timeout and retry cap.
- No build-time calls.
- No client-side calls.
- No raw vector display.
- No automatic ingest integration.
- No generated answers.

## Exclusions

This milestone excludes generated answers, RAG, chat, NVIDIA reranking, GPT comparison, automatic summaries, and public conversational search.
