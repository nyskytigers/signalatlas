import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  backfillSignalEmbeddings,
  buildSignalEmbeddingText,
  createNvidiaEmbeddingProvider,
  embedSignal,
  embedSignalIfNeeded,
  embeddingVersionMetadata,
  getNvidiaEmbeddingConfig,
  hashSignalEmbeddingText,
  NVIDIA_EMBEDDING_PROFILE,
  searchSignalsByEmbedding,
  searchSignalsHybrid,
  searchSignalsHybridReranked,
  validateEmbeddingResults,
  validateEmbeddingVector,
  EmbeddingConfigurationError,
  EmbeddingProviderDisabledError,
  EmbeddingValidationError,
  type EmbeddingProvider,
  type EmbeddingRepository,
  type EmbeddingVersionMetadata,
  type SignalEmbeddingRecord,
  type SignalEmbeddingSource,
} from "../lib/ai/embeddings";
import {
  createNvidiaRerankingProvider,
  getNvidiaRerankingConfig,
  NVIDIA_RERANKING_LIMITS,
  NVIDIA_RERANKING_PROFILE,
  RerankingConfigurationError,
  RerankingProviderDisabledError,
  RerankingValidationError,
  type RerankingProvider,
} from "../lib/ai/reranking";

type TestFn = () => void | Promise<void>;
const tests: Array<{ name: string; fn: TestFn }> = [];

function test(name: string, fn: TestFn) {
  tests.push({ name, fn });
}

function signal(overrides: Partial<SignalEmbeddingSource> = {}): SignalEmbeddingSource {
  return {
    id: "sig_1",
    title: "Underwater NeRF reconstruction",
    summary: "A shipwreck photogrammetry and NeRF dataset.",
    canonicalUrl: "https://example.com/signal",
    signalType: "PAPER",
    sourceName: "OpenHeritage3D",
    publishedAt: new Date("2026-06-01T00:00:00.000Z"),
    domains: ["marine archaeology", "digital heritage"],
    technologies: ["neural radiance fields", "Photogrammetry"],
    organizations: ["OpenHeritage3D"],
    researchers: ["Ada Researcher"],
    keywords: ["dataset", "shipwreck"],
    ...overrides,
  };
}

function mockProvider(
  vector: readonly number[] = [1, 0, 0],
  inputTypes?: Array<string | undefined>
): EmbeddingProvider {
  return {
    provider: "mock",
    model: "mock-model",
    version: "1.0.0",
    dimensions: vector.length,
    maxBatchSize: 16,
    async embed(inputs, options) {
      inputTypes?.push(options?.inputType);
      return inputs.map((_input, index) => ({ index, embedding: vector }));
    },
  };
}

function mockRepository(options: {
  existing?: SignalEmbeddingRecord | null;
  signals?: readonly SignalEmbeddingSource[];
  failSearch?: boolean;
  emptySearch?: boolean;
  failKeyword?: boolean;
} = {}) {
  const calls = {
    upsertSuccess: 0,
    upsertFailure: 0,
    failures: [] as Array<{ errorCode: string; errorMessage: string }>,
    searchVector: [] as number[][],
  };
  const records: SignalEmbeddingRecord[] = [];
  const signals = options.signals ?? [signal()];
  let current = options.existing ?? null;
  const repository: EmbeddingRepository = {
    async findSignal(signalId) {
      return signals.find((item) => item.id === signalId) ?? null;
    },
    async findSignals(args) {
      const selected = args.signalIds?.length
        ? signals.filter((item) => args.signalIds?.includes(item.id))
        : signals.slice(0, args.limit);
      if (!args.onlyMissing) return selected;
      return selected.filter((item) => item.id !== options.existing?.signalId);
    },
    async findCompatibleEmbedding() {
      return current;
    },
    async upsertSuccess(args) {
      calls.upsertSuccess += 1;
      const record: SignalEmbeddingRecord = {
        id: `embedding_${calls.upsertSuccess}`,
        signalId: args.signalId,
        provider: args.version.provider,
        model: args.version.model,
        providerVersion: args.version.providerVersion,
        embeddingVersion: args.version.embeddingVersion,
        inputVersion: args.version.inputVersion,
        dimensions: args.version.dimensions,
        contentHash: args.contentHash,
        sourceTextHash: args.sourceTextHash,
        status: "SUCCESS",
        errorCode: null,
        errorMessage: null,
      };
      current = record;
      records.push(record);
      return record;
    },
    async upsertFailure(args) {
      calls.upsertFailure += 1;
      calls.failures.push({ errorCode: args.errorCode, errorMessage: args.errorMessage });
      if (current?.status === "SUCCESS") return current;
      const record: SignalEmbeddingRecord = {
        id: `failure_${calls.upsertFailure}`,
        signalId: args.signalId,
        provider: args.version.provider,
        model: args.version.model,
        providerVersion: args.version.providerVersion,
        embeddingVersion: args.version.embeddingVersion,
        inputVersion: args.version.inputVersion,
        dimensions: args.version.dimensions,
        contentHash: args.contentHash,
        sourceTextHash: args.sourceTextHash,
        status: "FAILED",
        errorCode: args.errorCode,
        errorMessage: args.errorMessage,
      };
      current = record;
      records.push(record);
      return record;
    },
    async searchByVector(args) {
      calls.searchVector = [...calls.searchVector, [...args.vector]];
      if (options.failSearch || options.emptySearch) return [];
      return [
        {
          signalId: "sig_nearest",
          title: "Nearest signal",
          url: "https://example.com/nearest",
          signalType: "PAPER",
          similarity: 0.95,
          provider: args.version.provider,
          model: args.version.model,
          embeddingVersion: args.version.embeddingVersion,
        },
        {
          signalId: "sig_second",
          title: "Second signal",
          url: "https://example.com/second",
          signalType: "NEWS",
          similarity: 0.5,
          provider: args.version.provider,
          model: args.version.model,
          embeddingVersion: args.version.embeddingVersion,
        },
      ].slice(0, args.limit);
    },
    async searchKeyword() {
      if (options.failKeyword) throw new Error("Keyword retrieval failed.");
      if (options.emptySearch) return [];
      return [
        {
          signalId: "sig_keyword",
          title: "Keyword only",
          url: "https://example.com/keyword",
          signalType: "NEWS",
          score: 4,
        },
        {
          signalId: "sig_nearest",
          title: "Nearest signal",
          url: "https://example.com/nearest",
          signalType: "PAPER",
          score: 2,
        },
      ];
    },
  };
  return { repository, calls, records, currentRecord: () => current };
}

test("embedding text is stable, sorted, deduped, bounded, and hashable", () => {
  const first = buildSignalEmbeddingText(
    signal({
      technologies: ["Photogrammetry", "neural radiance fields", "Photogrammetry"],
      domains: ["digital heritage", "marine archaeology"],
      summary: ` extra   spaces ${"x".repeat(3000)} `,
    })
  );
  const second = buildSignalEmbeddingText(
    signal({
      technologies: ["neural radiance fields", "Photogrammetry"],
      domains: ["marine archaeology", "digital heritage", "marine archaeology"],
      summary: `extra spaces ${"x".repeat(3000)}`,
    })
  );

  assert.equal(first, second);
  assert.match(first, /^Title: Underwater NeRF reconstruction\nType: PAPER/m);
  assert.equal(first.includes("publishedAt"), false);
  assert.equal(first.includes("raw"), false);
  assert.equal(hashSignalEmbeddingText(first), hashSignalEmbeddingText(second));
  assert.ok(first.length <= 6000);
});

test("embedding URL context is host-only and keywords are cleaned and bounded", () => {
  const keywords = Array.from({ length: 45 }, (_, index) => `keyword-${String(index).padStart(2, "0")}`);
  const first = buildSignalEmbeddingText(
    signal({
      canonicalUrl:
        "https://user:secret@www.Example.com/research/item?utm_source=newsletter&token=secret&id=7",
      keywords: [...keywords, "<b>shipwreck</b>", '{"raw":"payload"}', "keyword-01"],
    })
  );
  const second = buildSignalEmbeddingText(
    signal({
      canonicalUrl: "https://example.com/another/path?id=7&utm_source=other",
      keywords: [...keywords].reverse(),
    })
  );

  assert.match(first, /\nHost: example\.com$/m);
  assert.equal(first.includes("URL:"), false);
  assert.equal(first.includes("user:secret"), false);
  assert.equal(first.includes("token="), false);
  assert.equal(first.includes("utm_source"), false);
  assert.equal(first.includes("<b>"), false);
  assert.equal(first.includes('{"raw"'), false);
  assert.equal(first.includes("keyword-40"), false);
  assert.equal(hashSignalEmbeddingText(first), hashSignalEmbeddingText(second));
});

test("provider config is disabled by default and validates enabled settings", () => {
  const disabled = getNvidiaEmbeddingConfig({});
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.model, NVIDIA_EMBEDDING_PROFILE.model);
  assert.equal(disabled.dimensions, NVIDIA_EMBEDDING_PROFILE.dimensions);
  assert.throws(
    () => getNvidiaEmbeddingConfig({ NVIDIA_EMBEDDING_ENABLED: "true" }),
    EmbeddingConfigurationError
  );
  assert.throws(
    () =>
      getNvidiaEmbeddingConfig({
        NVIDIA_EMBEDDING_MODEL: "another-model",
      }),
    EmbeddingConfigurationError
  );
  assert.throws(
    () => getNvidiaEmbeddingConfig({ NVIDIA_EMBEDDING_DIMENSIONS: "3" }),
    EmbeddingConfigurationError
  );
  assert.equal(
    getNvidiaEmbeddingConfig({
      NVIDIA_EMBEDDING_ENABLED: "true",
      NVIDIA_EMBEDDING_API_KEY: "key",
      NVIDIA_EMBEDDING_MODEL: NVIDIA_EMBEDDING_PROFILE.model,
      NVIDIA_EMBEDDING_DIMENSIONS: String(NVIDIA_EMBEDDING_PROFILE.dimensions),
      NVIDIA_EMBEDDING_BATCH_SIZE: "4",
      NVIDIA_EMBEDDING_MAX_RETRIES: "0",
    }).batchSize,
    4
  );
});

test("reranking config is disabled by default and validates enabled settings", () => {
  const disabled = getNvidiaRerankingConfig({});
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.model, NVIDIA_RERANKING_PROFILE.model);
  assert.equal(disabled.baseUrl, NVIDIA_RERANKING_PROFILE.endpointBaseUrl);
  assert.throws(
    () => getNvidiaRerankingConfig({ NVIDIA_RERANKING_ENABLED: "true" }),
    RerankingConfigurationError
  );
  assert.throws(
    () =>
      getNvidiaRerankingConfig({
        NVIDIA_RERANKING_MODEL: "another-model",
      }),
    RerankingConfigurationError
  );
  assert.throws(
    () => getNvidiaRerankingConfig({ NVIDIA_RERANKING_CANDIDATE_LIMIT: "31" }),
    RerankingConfigurationError
  );
  assert.throws(
    () => getNvidiaRerankingConfig({ NVIDIA_RERANKING_TIMEOUT_MS: "99" }),
    RerankingConfigurationError
  );
  assert.throws(
    () =>
      getNvidiaRerankingConfig({
        NVIDIA_RERANKING_TIMEOUT_MS: String(NVIDIA_RERANKING_LIMITS.maxTimeoutMs + 1),
      }),
    RerankingConfigurationError
  );
  assert.throws(
    () => getNvidiaRerankingConfig({ NVIDIA_RERANKING_MAX_RETRIES: "6" }),
    RerankingConfigurationError
  );
  assert.equal(
    getNvidiaRerankingConfig({
      NVIDIA_RERANKING_ENABLED: "true",
      NVIDIA_RERANKING_API_KEY: "key",
      NVIDIA_RERANKING_MODEL: NVIDIA_RERANKING_PROFILE.model,
      NVIDIA_RERANKING_MAX_RETRIES: "0",
      NVIDIA_RERANKING_CANDIDATE_LIMIT: "4",
      NVIDIA_RERANKING_RESULT_LIMIT: "2",
    }).candidateLimit,
    4
  );
});

test("vector validation rejects invalid vectors and result count mismatch", () => {
  assert.deepEqual(validateEmbeddingVector([1, 0, 0], 3), [1, 0, 0]);
  assert.throws(() => validateEmbeddingVector([], 3), EmbeddingValidationError);
  assert.throws(() => validateEmbeddingVector([1, 0], 3), EmbeddingValidationError);
  assert.throws(() => validateEmbeddingVector([1, 0, 0, 0], 3), EmbeddingValidationError);
  assert.throws(() => validateEmbeddingVector([Number.NaN, 0, 0], 3), EmbeddingValidationError);
  assert.throws(() => validateEmbeddingVector([Number.POSITIVE_INFINITY, 0, 0], 3), EmbeddingValidationError);
  assert.throws(() => validateEmbeddingVector(["1", 0, 0], 3), EmbeddingValidationError);
  assert.throws(() => validateEmbeddingResults([], 1, 3), EmbeddingValidationError);
});

test("NVIDIA embedding provider succeeds, retries transient failures, and avoids disabled calls", async () => {
  await assert.rejects(
    () => createNvidiaEmbeddingProvider({}).embed(["query"]),
    EmbeddingProviderDisabledError
  );

  let calls = 0;
  let requestBody: Record<string, unknown> | null = null;
  const embedding = Array.from(
    { length: NVIDIA_EMBEDDING_PROFILE.dimensions },
    (_value, index) => (index === 0 ? 1 : 0)
  );
  const provider = createNvidiaEmbeddingProvider(
    {
      NVIDIA_EMBEDDING_ENABLED: "true",
      NVIDIA_EMBEDDING_API_KEY: "key",
      NVIDIA_EMBEDDING_MODEL: NVIDIA_EMBEDDING_PROFILE.model,
      NVIDIA_EMBEDDING_DIMENSIONS: String(NVIDIA_EMBEDDING_PROFILE.dimensions),
    },
    {
      fetch: async (_url, init) => {
        calls += 1;
        requestBody = JSON.parse(init.body) as Record<string, unknown>;
        if (calls === 1) return new Response("{}", { status: 500 });
        return new Response(
          JSON.stringify({
            model: NVIDIA_EMBEDDING_PROFILE.model,
            data: [{ index: 0, embedding }],
          }),
          { status: 200 }
        );
      },
    }
  );
  const result = await provider.embed(["query"], { inputType: "query" });
  assert.equal(calls, 2);
  assert.deepEqual(result[0].embedding, embedding);
  const body = requestBody as unknown as Record<string, unknown>;
  assert.equal(body.input_type, "query");
  assert.equal(body.dimensions, NVIDIA_EMBEDDING_PROFILE.dimensions);
  assert.equal(body.truncate, NVIDIA_EMBEDDING_PROFILE.truncate);
  assert.equal(body.modality, "text");
});

test("NVIDIA embedding provider rejects a mismatched response model", async () => {
  const provider = createNvidiaEmbeddingProvider(
    {
      NVIDIA_EMBEDDING_ENABLED: "true",
      NVIDIA_EMBEDDING_API_KEY: "key",
    },
    {
      fetch: async () =>
        new Response(
          JSON.stringify({
            model: "another-model",
            data: [
              {
                index: 0,
                embedding: Array(NVIDIA_EMBEDDING_PROFILE.dimensions).fill(0),
              },
            ],
          }),
          { status: 200 }
        ),
    }
  );

  await assert.rejects(
    () => provider.embed(["query"], { inputType: "query" }),
    EmbeddingValidationError
  );
});

test("NVIDIA reranking provider succeeds, sends hosted request shape, and avoids disabled calls", async () => {
  await assert.rejects(
    () =>
      createNvidiaRerankingProvider({}).rerank({
        query: "shipwreck mapping",
        candidates: [{ id: "sig_1", text: "mapping", originalRank: 1 }],
        topN: 1,
      }),
    RerankingProviderDisabledError
  );

  let requestUrl = "";
  let requestBody: Record<string, unknown> | null = null;
  const provider = createNvidiaRerankingProvider(
    {
      NVIDIA_RERANKING_ENABLED: "true",
      NVIDIA_RERANKING_API_KEY: "key",
      NVIDIA_RERANKING_MODEL: NVIDIA_RERANKING_PROFILE.model,
      NVIDIA_RERANKING_CANDIDATE_LIMIT: "4",
      NVIDIA_RERANKING_RESULT_LIMIT: "2",
      NVIDIA_RERANKING_MAX_RETRIES: "0",
    },
    {
      fetch: async (url, init) => {
        requestUrl = url;
        requestBody = JSON.parse(init.body) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            rankings: [
              { index: 1, logit: 2.5 },
              { index: 0, logit: -1.25 },
            ],
          }),
          { status: 200 }
        );
      },
    }
  );
  const result = await provider.rerank({
    query: "shipwreck mapping",
    candidates: [
      { id: "sig_a", text: "bakery notes", originalRank: 1 },
      { id: "sig_b", text: "underwater mapping", originalRank: 2 },
    ],
    topN: 1,
  });

  assert.equal(requestUrl, `${NVIDIA_RERANKING_PROFILE.endpointBaseUrl}/retrieval/${NVIDIA_RERANKING_PROFILE.model}/reranking`);
  const body = requestBody as unknown as {
    model: string;
    query: { text: string };
    passages: Array<{ text: string }>;
    truncate: string;
  };
  assert.equal(body.model, NVIDIA_RERANKING_PROFILE.model);
  assert.equal(body.query.text, "shipwreck mapping");
  assert.equal(body.passages.length, 2);
  assert.equal(body.truncate, NVIDIA_RERANKING_PROFILE.truncate);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "sig_b");
  assert.equal(result[0].originalRank, 2);
  assert.equal(result[0].rerankedRank, 1);
  assert.equal(result[0].rerankScore, 2.5);
});

test("NVIDIA reranking provider rejects invalid response indices", async () => {
  const provider = createNvidiaRerankingProvider(
    {
      NVIDIA_RERANKING_ENABLED: "true",
      NVIDIA_RERANKING_API_KEY: "key",
      NVIDIA_RERANKING_MAX_RETRIES: "0",
    },
    {
      fetch: async () =>
        new Response(
          JSON.stringify({
            rankings: [
              { index: 0, logit: 1 },
              { index: 0, logit: 0.5 },
            ],
          }),
          { status: 200 }
        ),
    }
  );

  await assert.rejects(
    () =>
      provider.rerank({
        query: "shipwreck",
        candidates: [
          { id: "sig_a", text: "shipwreck", originalRank: 1 },
          { id: "sig_b", text: "pastry", originalRank: 2 },
        ],
        topN: 2,
      }),
    RerankingValidationError
  );
});

test("NVIDIA reranking provider orders ties deterministically and rejects negative indices", async () => {
  const provider = createNvidiaRerankingProvider(
    {
      NVIDIA_RERANKING_ENABLED: "true",
      NVIDIA_RERANKING_API_KEY: "key",
      NVIDIA_RERANKING_MAX_RETRIES: "0",
    },
    {
      fetch: async () =>
        new Response(
          JSON.stringify({ rankings: [{ index: 1, logit: 2 }, { index: 0, logit: 2 }] }),
          { status: 200 }
        ),
    }
  );
  const ordered = await provider.rerank({
    query: "shipwreck",
    candidates: [
      { id: "sig_a", text: "first", originalRank: 1 },
      { id: "sig_b", text: "second", originalRank: 2 },
    ],
    topN: 2,
  });
  assert.deepEqual(ordered.map((result) => result.id), ["sig_a", "sig_b"]);

  const invalidProvider = createNvidiaRerankingProvider(
    {
      NVIDIA_RERANKING_ENABLED: "true",
      NVIDIA_RERANKING_API_KEY: "key",
      NVIDIA_RERANKING_MAX_RETRIES: "0",
    },
    {
      fetch: async () =>
        new Response(JSON.stringify({ rankings: [{ index: -1, logit: 2 }] }), { status: 200 }),
    }
  );
  await assert.rejects(
    () =>
      invalidProvider.rerank({
        query: "shipwreck",
        candidates: [{ id: "sig_a", text: "first", originalRank: 1 }],
        topN: 1,
      }),
    RerankingValidationError
  );
});

test("NVIDIA reranking provider rejects malformed JSON without retrying", async () => {
  let requests = 0;
  const provider = createNvidiaRerankingProvider(
    {
      NVIDIA_RERANKING_ENABLED: "true",
      NVIDIA_RERANKING_API_KEY: "key",
      NVIDIA_RERANKING_MAX_RETRIES: "2",
    },
    {
      fetch: async () => {
        requests += 1;
        return new Response("not-json", { status: 200 });
      },
    }
  );
  await assert.rejects(
    () =>
      provider.rerank({
        query: "shipwreck",
        candidates: [{ id: "sig_a", text: "first", originalRank: 1 }],
        topN: 1,
      }),
    RerankingValidationError
  );
  assert.equal(requests, 1);
});

test("embedding service stores new, skips unchanged, force refreshes, and stores failure", async () => {
  const inputTypes: Array<string | undefined> = [];
  const provider = mockProvider([1, 0, 0], inputTypes);
  const text = buildSignalEmbeddingText(signal());
  const hash = hashSignalEmbeddingText(text);
  const version = embeddingVersionMetadata(provider);
  const { repository, calls } = mockRepository({
    existing: {
      id: "existing",
      signalId: "sig_1",
      provider: version.provider,
      model: version.model,
      providerVersion: version.providerVersion,
      embeddingVersion: version.embeddingVersion,
      inputVersion: version.inputVersion,
      dimensions: version.dimensions,
      contentHash: hash,
      sourceTextHash: hash,
      status: "SUCCESS",
      errorCode: null,
      errorMessage: null,
    },
  });

  const skipped = await embedSignal("sig_1", { provider, repository });
  assert.equal(skipped.status, "SKIPPED");
  assert.equal(calls.upsertSuccess, 0);

  const forced = await embedSignal("sig_1", { provider, repository, force: true });
  assert.equal(forced.status, "SUCCESS");
  assert.equal(calls.upsertSuccess, 1);
  assert.deepEqual(inputTypes, [NVIDIA_EMBEDDING_PROFILE.documentInputType]);

  const failingProvider: EmbeddingProvider = {
    ...provider,
    async embed() {
      throw new EmbeddingValidationError("bad vector");
    },
  };
  const failed = await embedSignal("sig_1", {
    provider: failingProvider,
    repository,
    force: true,
  });
  assert.equal(failed.status, "FAILED");
  assert.equal(calls.upsertFailure, 1);
});

test("invalid provider vectors are rejected before successful persistence", async () => {
  const provider: EmbeddingProvider = {
    ...mockProvider(),
    dimensions: 3,
    async embed() {
      return [{ index: 0, embedding: [1, 0] }];
    },
  };
  const { repository, calls } = mockRepository();

  const result = await embedSignal("sig_1", { provider, repository });

  assert.equal(result.status, "FAILED");
  assert.equal(calls.upsertSuccess, 0);
  assert.equal(calls.upsertFailure, 1);
});

test("new failures are sanitized and stored without an embedding", async () => {
  const provider: EmbeddingProvider = {
    ...mockProvider(),
    async embed() {
      throw Object.assign(
        new Error("Bearer secret-token https://user:pass@example.com/path?api_key=secret-value"),
        { code: "Provider BAD/Response" }
      );
    },
  };
  const { repository, calls, currentRecord } = mockRepository();

  const result = await embedSignal("sig_1", { provider, repository });

  assert.equal(result.status, "FAILED");
  assert.equal(currentRecord()?.status, "FAILED");
  assert.equal(calls.failures[0].errorCode, "provider_bad_response");
  assert.equal(calls.failures[0].errorMessage.includes("secret-token"), false);
  assert.equal(calls.failures[0].errorMessage.includes("user:pass"), false);
  assert.equal(calls.failures[0].errorMessage.includes("secret-value"), false);
});

test("failure after success preserves the compatible successful record", async () => {
  const version = embeddingVersionMetadata(mockProvider());
  const existing: SignalEmbeddingRecord = {
    id: "existing-success",
    signalId: "sig_1",
    provider: version.provider,
    model: version.model,
    providerVersion: version.providerVersion,
    embeddingVersion: version.embeddingVersion,
    inputVersion: version.inputVersion,
    dimensions: version.dimensions,
    contentHash: "old-hash",
    sourceTextHash: "old-hash",
    status: "SUCCESS",
    errorCode: null,
    errorMessage: null,
  };
  const provider: EmbeddingProvider = {
    ...mockProvider(),
    async embed() {
      throw new EmbeddingValidationError("temporary bad vector");
    },
  };
  const { repository, currentRecord } = mockRepository({ existing });

  const result = await embedSignal("sig_1", { provider, repository, force: true });

  assert.equal(result.status, "FAILED");
  assert.equal(currentRecord()?.id, "existing-success");
  assert.equal(currentRecord()?.status, "SUCCESS");
  assert.equal(currentRecord()?.contentHash, "old-hash");
});

test("successful retry replaces a compatible failed record", async () => {
  const version = embeddingVersionMetadata(mockProvider());
  const failed: SignalEmbeddingRecord = {
    id: "existing-failure",
    signalId: "sig_1",
    provider: version.provider,
    model: version.model,
    providerVersion: version.providerVersion,
    embeddingVersion: version.embeddingVersion,
    inputVersion: version.inputVersion,
    dimensions: version.dimensions,
    contentHash: "failed-hash",
    sourceTextHash: "failed-hash",
    status: "FAILED",
    errorCode: "temporary_error",
    errorMessage: "Temporary error",
  };
  const { repository, currentRecord } = mockRepository({ existing: failed });

  const result = await embedSignal("sig_1", {
    provider: mockProvider(),
    repository,
  });

  assert.equal(result.status, "SUCCESS");
  assert.equal(currentRecord()?.status, "SUCCESS");
  assert.equal(currentRecord()?.errorCode, null);
});

test("embedSignalIfNeeded reports disabled or failure without throwing by default", async () => {
  const { repository } = mockRepository();
  const result = await embedSignalIfNeeded("sig_1", {
    provider: createNvidiaEmbeddingProvider({}),
    repository,
  });
  assert.equal(result.status, "DISABLED");
});

test("backfill dry-run makes no provider call and supports single signal mode", async () => {
  let providerCalls = 0;
  const provider: EmbeddingProvider = {
    ...mockProvider(),
    async embed() {
      providerCalls += 1;
      return [{ index: 0, embedding: [1, 0, 0] }];
    },
  };
  const { repository } = mockRepository({ signals: [signal({ id: "sig_1" }), signal({ id: "sig_2" })] });
  const results = await backfillSignalEmbeddings({
    signalIds: ["sig_2"],
    limit: 1,
    dryRun: true,
    provider,
    repository,
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].signalId, "sig_2");
  assert.equal(providerCalls, 0);
});

test("semantic search ranks repository vector results and enforces limit", async () => {
  const { repository, calls } = mockRepository();
  const inputTypes: Array<string | undefined> = [];
  const results = await searchSignalsByEmbedding({
    query: "underwater slam using nerf",
    limit: 1,
    provider: mockProvider([0.9, 0.1, 0], inputTypes),
    repository,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].signalId, "sig_nearest");
  assert.deepEqual(calls.searchVector[0], [0.9, 0.1, 0]);
  assert.deepEqual(inputTypes, [NVIDIA_EMBEDDING_PROFILE.queryInputType]);
});

test("semantic search rejects a query vector dimension mismatch before SQL", async () => {
  const provider: EmbeddingProvider = {
    ...mockProvider(),
    dimensions: 3,
    async embed() {
      return [{ index: 0, embedding: [1, 0] }];
    },
  };
  const { repository, calls } = mockRepository();

  await assert.rejects(
    () => searchSignalsByEmbedding({ query: "shipwreck", provider, repository }),
    EmbeddingValidationError
  );
  assert.equal(calls.searchVector.length, 0);
});

test("hybrid retrieval merges overlaps and applies exact formula", async () => {
  const { repository } = mockRepository();
  const results = await searchSignalsHybrid({
    query: "shipwreck keyword",
    limit: 10,
    provider: mockProvider(),
    repository,
  });
  const overlap = results.find((result) => result.signal.id === "sig_nearest");
  const keywordOnly = results.find((result) => result.signal.id === "sig_keyword");

  assert.ok(overlap);
  assert.ok(keywordOnly);
  assert.deepEqual(overlap.matchedBy, ["semantic", "keyword"]);
  assert.equal(overlap.hybridScore, overlap.semanticScore * 0.65 + overlap.keywordScore * 0.35);
  assert.equal(keywordOnly.matchedBy[0], "keyword");
});

test("reranked hybrid search preserves original order when reranking is disabled", async () => {
  const { repository } = mockRepository();
  const response = await searchSignalsHybridReranked({
    query: "shipwreck keyword",
    limit: 2,
    embeddingProvider: mockProvider(),
    rerankingProvider: createNvidiaRerankingProvider({}),
    repository,
  });

  assert.equal(response.rerankingStatus, "disabled");
  assert.equal(response.candidatesRetrieved, 3);
  assert.equal(response.results.length, 2);
  assert.deepEqual(
    response.results.map((result) => result.originalRank),
    [1, 2]
  );
  assert.deepEqual(
    response.results.map((result) => result.rerankedRank),
    [1, 2]
  );
  assert.equal(response.results.every((result) => result.reranked === false), true);
  assert.ok(Number.isFinite(response.retrievalLatencyMs));
  assert.ok(Number.isFinite(response.rerankingLatencyMs));
});

test("reranked hybrid search returns top reranked results and keeps original ranks", async () => {
  const { repository } = mockRepository();
  const seenCandidates: string[] = [];
  const rerankingProvider: RerankingProvider = {
    provider: "mock-rerank",
    model: "mock-rerank-model",
    version: "1.0.0",
    maxCandidates: 30,
    maxResults: 10,
    async rerank(input) {
      seenCandidates.push(...input.candidates.map((candidate) => candidate.text));
      return [
        {
          id: "sig_keyword",
          originalRank: 2,
          rerankedRank: 1,
          rerankScore: 3,
        },
        {
          id: "sig_nearest",
          originalRank: 1,
          rerankedRank: 2,
          rerankScore: 1,
        },
      ];
    },
  };

  const response = await searchSignalsHybridReranked({
    query: "shipwreck keyword",
    limit: 2,
    embeddingProvider: mockProvider(),
    rerankingProvider,
    repository,
  });

  assert.equal(response.rerankingStatus, "success");
  assert.deepEqual(
    response.results.map((result) => result.signal.id),
    ["sig_keyword", "sig_nearest"]
  );
  assert.deepEqual(
    response.results.map((result) => result.originalRank),
    [2, 1]
  );
  assert.deepEqual(
    response.results.map((result) => result.rerankedRank),
    [1, 2]
  );
  assert.equal(response.results[0].rerankScore, 3);
  assert.equal(response.results.every((result) => result.reranked === true), true);
  assert.ok(seenCandidates.some((text) => text.includes("Title:")));
  assert.ok(Number.isFinite(response.rerankingLatencyMs));
  assert.ok(Number.isFinite(response.candidatePreparationLatencyMs));
  assert.ok(Number.isFinite(response.totalLatencyMs));
});

test("reranked search uses provider limits and falls back on partial provider results", async () => {
  const { repository } = mockRepository();
  let candidateCount = 0;
  const partialProvider: RerankingProvider = {
    provider: "mock-rerank",
    model: "mock-rerank-model",
    version: "1.0.0",
    maxCandidates: 2,
    maxResults: 1,
    async rerank(input) {
      candidateCount = input.candidates.length;
      return [
        {
          id: input.candidates[0].id,
          originalRank: input.candidates[0].originalRank,
          rerankedRank: 1,
          rerankScore: 1,
        },
      ];
    },
  };
  const limited = await searchSignalsHybridReranked({
    query: "shipwreck keyword",
    limit: 50,
    embeddingProvider: mockProvider(),
    rerankingProvider: partialProvider,
    repository,
  });
  assert.equal(candidateCount, 2);
  assert.equal(limited.results.length, 1);

  const fallbackProvider: RerankingProvider = {
    ...partialProvider,
    maxResults: 2,
  };
  const fallback = await searchSignalsHybridReranked({
    query: "shipwreck keyword",
    limit: 2,
    embeddingProvider: mockProvider(),
    rerankingProvider: fallbackProvider,
    repository,
  });
  assert.equal(fallback.rerankingStatus, "failed");
  assert.equal(fallback.fallbackUsed, true);
  assert.deepEqual(fallback.results.map((result) => result.originalRank), [1, 2]);
  assert.equal(fallback.results.every((result) => result.rerankScore === null), true);
});

test("reranked search keeps unsafe persisted content out of candidate passages", async () => {
  const sourceSignals = [
    signal({
      id: "sig_nearest",
      summary: '<b>Shipwreck</b> api_key=do-not-send https://example.com/?token=do-not-send',
      organizations: ['{"raw":"payload"}'],
    }),
    signal({ id: "sig_second" }),
    signal({ id: "sig_keyword" }),
  ];
  const { repository } = mockRepository({ signals: sourceSignals });
  const passages: string[] = [];
  const rerankingProvider: RerankingProvider = {
    provider: "mock-rerank",
    model: "mock-rerank-model",
    version: "1.0.0",
    maxCandidates: 30,
    maxResults: 2,
    async rerank(input) {
      passages.push(...input.candidates.map((candidate) => candidate.text));
      return input.candidates.slice(0, input.topN).map((candidate, index) => ({
        id: candidate.id,
        originalRank: candidate.originalRank,
        rerankedRank: index + 1,
        rerankScore: input.topN - index,
      }));
    },
  };
  await searchSignalsHybridReranked({
    query: "shipwreck",
    limit: 2,
    embeddingProvider: mockProvider(),
    rerankingProvider,
    repository,
  });
  const submitted = passages.join("\n");
  assert.equal(submitted.includes("<b>"), false);
  assert.equal(submitted.includes("do-not-send"), false);
  assert.equal(submitted.includes('"raw"'), false);
});

test("reranked search skips the provider for empty retrieval and propagates retrieval errors", async () => {
  let calls = 0;
  const rerankingProvider: RerankingProvider = {
    provider: "mock-rerank",
    model: "mock-rerank-model",
    version: "1.0.0",
    maxCandidates: 30,
    maxResults: 10,
    async rerank() {
      calls += 1;
      return [];
    },
  };
  const empty = await searchSignalsHybridReranked({
    query: "shipwreck",
    embeddingProvider: mockProvider(),
    rerankingProvider,
    repository: mockRepository({ emptySearch: true }).repository,
  });
  assert.equal(empty.rerankingStatus, "skipped");
  assert.equal(empty.fallbackUsed, false);
  assert.equal(calls, 0);

  await assert.rejects(() =>
    searchSignalsHybridReranked({
      query: "shipwreck",
      embeddingProvider: mockProvider(),
      rerankingProvider,
      repository: mockRepository({ failKeyword: true }).repository,
    })
  );
});

test("reranked search safely falls back when enabled NVIDIA reranking has no API key", async () => {
  const original = {
    enabled: process.env.NVIDIA_RERANKING_ENABLED,
    rerankingKey: process.env.NVIDIA_RERANKING_API_KEY,
    sharedKey: process.env.NVIDIA_API_KEY,
  };
  try {
    process.env.NVIDIA_RERANKING_ENABLED = "true";
    delete process.env.NVIDIA_RERANKING_API_KEY;
    delete process.env.NVIDIA_API_KEY;
    const response = await searchSignalsHybridReranked({
      query: "shipwreck",
      limit: 2,
      embeddingProvider: mockProvider(),
      repository: mockRepository().repository,
    });
    assert.equal(response.rerankingStatus, "failed");
    assert.equal(response.fallbackUsed, true);
    assert.equal(response.errorCode, "configuration_error");
    assert.equal(response.results.length, 2);
    assert.equal(response.results.every((result) => result.rerankScore === null), true);
  } finally {
    if (original.enabled == null) delete process.env.NVIDIA_RERANKING_ENABLED;
    else process.env.NVIDIA_RERANKING_ENABLED = original.enabled;
    if (original.rerankingKey == null) delete process.env.NVIDIA_RERANKING_API_KEY;
    else process.env.NVIDIA_RERANKING_API_KEY = original.rerankingKey;
    if (original.sharedKey == null) delete process.env.NVIDIA_API_KEY;
    else process.env.NVIDIA_API_KEY = original.sharedKey;
  }
});

test("hybrid weights validate", async () => {
  await assert.rejects(() =>
    searchSignalsHybrid({
      query: "shipwreck",
      semanticWeight: 0.9,
      keywordWeight: 0.9,
      provider: mockProvider(),
      repository: mockRepository().repository,
    })
  );
});

test("embedding version metadata changes with dimensions", () => {
  const first = embeddingVersionMetadata(mockProvider([1, 0, 0]));
  const second: EmbeddingVersionMetadata = embeddingVersionMetadata(mockProvider([1, 0]));
  assert.notEqual(first.embeddingVersion, second.embeddingVersion);
});

test("Prisma schema and pending migration use the authoritative vector dimension", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const migration = readFileSync(
    "prisma/migrations/20260713000000_add_signal_embeddings/migration.sql",
    "utf8"
  );
  const vectorType = `vector(${NVIDIA_EMBEDDING_PROFILE.dimensions})`;

  assert.ok(schema.includes(`Unsupported(\"${vectorType}\")?`));
  assert.ok(migration.includes(`\"embedding\" ${vectorType}`));
});

async function run() {
  for (const { name, fn } of tests) {
    await fn();
    console.log(`ok - ${name}`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
