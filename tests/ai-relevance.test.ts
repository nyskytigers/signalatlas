import assert from "node:assert/strict";
import {
  assessSignalWithNvidia,
  buildNvidiaRelevancePrompt,
  createNvidiaRelevanceProvider,
  getNvidiaRelevanceConfig,
  normalizeAssessmentInput,
  normalizeProviderAssessment,
  NvidiaConfigurationError,
  NvidiaProviderDisabledError,
  NvidiaSchemaValidationError,
  validateProviderAssessment,
  validateProviderJsonText,
  type AssessmentPersistenceClient,
  type ProviderRelevanceAssessment,
  type RelevanceAssessmentInput,
  type RelevanceAssessmentProvider,
  type SignalRelevanceAssessmentCreateInput,
  type StoredAssessmentRecord,
} from "../lib/ai/relevance";
import { DEFAULT_RELEVANCE_WEIGHTS, RELEVANCE_DIMENSIONS, scoreToBand } from "../lib/relevance";

type TestFn = () => void | Promise<void>;
const tests: Array<{ name: string; fn: TestFn }> = [];

function test(name: string, fn: TestFn) {
  tests.push({ name, fn });
}

const validDimensions = {
  researchRelevance: 80,
  novelty: 60,
  technologyImpact: 70,
  portfolioUsefulness: 50,
  graduateValue: 40,
  communityAttention: 20,
};

function validProviderAssessment(
  overrides: Partial<ProviderRelevanceAssessment> = {}
): ProviderRelevanceAssessment {
  return {
    provider: "nvidia",
    model: "test-model",
    providerVersion: "1.0.0",
    promptVersion: "1.0.0",
    domains: [
      {
        domain: "marineArchaeology",
        confidence: 0.9,
        evidence: ["structured domain"],
      },
    ],
    technologies: [
      {
        technology: "neural radiance fields",
        confidence: 0.8,
        evidence: ["technology alias"],
      },
    ],
    dimensionScores: validDimensions,
    confidence: 0.9,
    explanation: "Relevant marine archaeology signal with reusable technology.",
    dimensionExplanations: {
      researchRelevance: ["Marine archaeology context."],
      novelty: ["Observable release language."],
      technologyImpact: ["Uses canonical technology."],
      portfolioUsefulness: ["Could support a student prototype."],
      graduateValue: ["Research context is present."],
      communityAttention: ["Limited supplied attention evidence."],
    },
    warnings: [],
    ...overrides,
  };
}

function validResponseText(overrides: Partial<ProviderRelevanceAssessment> = {}) {
  return JSON.stringify(validProviderAssessment(overrides));
}

function response(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

function completion(content: string) {
  return {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  };
}

const input: RelevanceAssessmentInput = {
  signalId: "sig_1",
  title: "Underwater archaeology NeRF dataset",
  summary: "A new shipwreck reconstruction dataset with a GitHub repository.",
  signalType: "DATASET",
  sourceName: "OpenHeritage3D",
  canonicalUrl: "https://example.com/signal",
  publishedAt: "2026-06-01T00:00:00.000Z",
  domains: ["marine archaeology"],
  technologies: ["neural radiance fields"],
  organizations: ["OpenHeritage3D"],
  raw: { secret: "do-not-send" },
};

test("provider disabled by default", () => {
  const provider = createNvidiaRelevanceProvider({});
  assert.equal(provider.model, "disabled");
  assert.rejects(() => provider.assess(input), NvidiaProviderDisabledError);
});

test("enabled provider validates required configuration", () => {
  assert.throws(
    () => getNvidiaRelevanceConfig({ NVIDIA_RELEVANCE_ENABLED: "true" }),
    NvidiaConfigurationError
  );
  assert.throws(
    () =>
      getNvidiaRelevanceConfig({
        NVIDIA_RELEVANCE_ENABLED: "true",
        NVIDIA_API_KEY: "key",
      }),
    NvidiaConfigurationError
  );
});

test("timeout and retry configuration parse safely", () => {
  const config = getNvidiaRelevanceConfig({
    NVIDIA_RELEVANCE_ENABLED: "true",
    NVIDIA_API_KEY: "key",
    NVIDIA_RELEVANCE_MODEL: "model",
    NVIDIA_RELEVANCE_TIMEOUT_MS: "5000",
    NVIDIA_RELEVANCE_MAX_RETRIES: "0",
  });

  assert.equal(config.timeoutMs, 5000);
  assert.equal(config.maxRetries, 0);
  assert.throws(() =>
    getNvidiaRelevanceConfig({
      NVIDIA_RELEVANCE_ENABLED: "true",
      NVIDIA_API_KEY: "key",
      NVIDIA_RELEVANCE_MODEL: "model",
      NVIDIA_RELEVANCE_MAX_RETRIES: "-1",
    })
  );
});

test("prompt includes version, dimensions, bounded input, and JSON-only instruction", () => {
  const normalized = normalizeAssessmentInput({
    ...input,
    summary: "x".repeat(5000),
  });
  const prompt = buildNvidiaRelevancePrompt(normalized);

  assert.match(prompt, /Prompt version: 1\.0\.0/);
  assert.match(prompt, /Return JSON only/);
  for (const dimension of RELEVANCE_DIMENSIONS) {
    assert.match(prompt, new RegExp(dimension));
  }
  assert.ok(normalized.summary && normalized.summary.length <= 4000);
  assert.equal(prompt.includes("do-not-send"), false);
});

test("valid provider response passes schema validation", () => {
  const result = validateProviderAssessment(validProviderAssessment());
  assert.equal(result.ok, true);
});

test("schema rejects missing dimensions, extra fields, invalid scores, and confidence", () => {
  const missingDimension = {
    ...validProviderAssessment(),
    dimensionScores: { ...validDimensions, communityAttention: undefined },
  };
  assert.equal(validateProviderAssessment(missingDimension).ok, false);
  assert.equal(
    validateProviderAssessment({ ...validProviderAssessment(), finalScore: 99 }).ok,
    false
  );
  assert.equal(
    validateProviderAssessment({
      ...validProviderAssessment(),
      dimensionScores: { ...validDimensions, novelty: -1 },
    }).ok,
    false
  );
  assert.equal(
    validateProviderAssessment({
      ...validProviderAssessment(),
      dimensionScores: { ...validDimensions, novelty: 101 },
    }).ok,
    false
  );
  assert.equal(
    validateProviderAssessment({
      ...validProviderAssessment(),
      dimensionScores: { ...validDimensions, novelty: Number.NaN },
    }).ok,
    false
  );
  assert.equal(validateProviderAssessment({ ...validProviderAssessment(), confidence: -0.1 }).ok, false);
  assert.equal(validateProviderAssessment({ ...validProviderAssessment(), confidence: 1.1 }).ok, false);
});

test("schema normalizes duplicate domains and technologies", () => {
  const result = validateProviderAssessment(
    validProviderAssessment({
      domains: [
        { domain: "marineArchaeology", confidence: 0.7, evidence: ["a"] },
        { domain: "marineArchaeology", confidence: 0.9, evidence: ["b"] },
      ],
      technologies: [
        { technology: "NeRF", confidence: 0.7, evidence: ["a"] },
        { technology: "neural radiance fields", confidence: 0.9, evidence: ["b"] },
      ],
    })
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.domains.length, 1);
    assert.deepEqual(result.value.technologies.map((technology) => technology.technology), ["NeRF"]);
  }
});

test("unknown technologies become warnings and are excluded", () => {
  const result = validateProviderAssessment(
    validProviderAssessment({
      technologies: [{ technology: "Imaginary Sensor", confidence: 0.5, evidence: ["title"] }],
    })
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value.technologies, []);
    assert.ok(result.value.warnings.some((warning) => warning.includes("Imaginary Sensor")));
  }
});

test("invalid JSON fails and markdown-wrapped JSON is explicitly extracted", () => {
  assert.throws(() => validateProviderJsonText("{invalid"), /Invalid JSON/);
  const parsed = validateProviderJsonText(`\`\`\`json\n${validResponseText()}\n\`\`\``);
  assert.equal(parsed.assessment.provider, "nvidia");
});

test("successful network response returns validated metadata", async () => {
  const provider = createNvidiaRelevanceProvider(
    {
      NVIDIA_RELEVANCE_ENABLED: "true",
      NVIDIA_API_KEY: "secret",
      NVIDIA_RELEVANCE_MODEL: "model",
    },
    {
      fetch: async () =>
        response(completion(validResponseText()), 200, { "x-request-id": "request_1" }),
    }
  );
  const result = await provider.assess(input, { storeRawResponse: true });

  assert.equal(result.assessment.model, "model");
  assert.equal(result.requestMetadata.providerRequestId, "request_1");
  assert.equal(result.requestMetadata.tokenUsage?.totalTokens, 30);
  assert.ok(result.rawResponse);
});

test("network retries 429 and 500 but not 401", async () => {
  let rateLimitCalls = 0;
  const rateLimitProvider = createNvidiaRelevanceProvider(
    {
      NVIDIA_RELEVANCE_ENABLED: "true",
      NVIDIA_API_KEY: "secret",
      NVIDIA_RELEVANCE_MODEL: "model",
    },
    {
      fetch: async () => {
        rateLimitCalls += 1;
        return rateLimitCalls === 1
          ? response({ error: "slow down" }, 429, { "retry-after": "0" })
          : response(completion(validResponseText()));
      },
    }
  );
  await rateLimitProvider.assess(input);
  assert.equal(rateLimitCalls, 2);

  let serverCalls = 0;
  const serverProvider = createNvidiaRelevanceProvider(
    {
      NVIDIA_RELEVANCE_ENABLED: "true",
      NVIDIA_API_KEY: "secret",
      NVIDIA_RELEVANCE_MODEL: "model",
    },
    {
      fetch: async () => {
        serverCalls += 1;
        return serverCalls === 1
          ? response({ error: "temporary" }, 500)
          : response(completion(validResponseText()));
      },
    }
  );
  await serverProvider.assess(input);
  assert.equal(serverCalls, 2);

  let unauthorizedCalls = 0;
  const unauthorizedProvider = createNvidiaRelevanceProvider(
    {
      NVIDIA_RELEVANCE_ENABLED: "true",
      NVIDIA_API_KEY: "secret",
      NVIDIA_RELEVANCE_MODEL: "model",
    },
    {
      fetch: async () => {
        unauthorizedCalls += 1;
        return response({ error: "no" }, 401);
      },
    }
  );
  await assert.rejects(() => unauthorizedProvider.assess(input, { maxRetries: 2 }));
  assert.equal(unauthorizedCalls, 1);
});

test("network timeout and retry exhaustion fail clearly", async () => {
  const provider = createNvidiaRelevanceProvider(
    {
      NVIDIA_RELEVANCE_ENABLED: "true",
      NVIDIA_API_KEY: "secret",
      NVIDIA_RELEVANCE_MODEL: "model",
    },
    {
      fetch: async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    }
  );

  await assert.rejects(() => provider.assess(input, { timeoutMs: 5, maxRetries: 0 }), /timed out/);
});

test("malformed successful response is not retried", async () => {
  let calls = 0;
  const provider = createNvidiaRelevanceProvider(
    {
      NVIDIA_RELEVANCE_ENABLED: "true",
      NVIDIA_API_KEY: "secret",
      NVIDIA_RELEVANCE_MODEL: "model",
    },
    {
      fetch: async () => {
        calls += 1;
        return response(completion("{bad"));
      },
    }
  );

  await assert.rejects(() => provider.assess(input, { maxRetries: 2 }));
  assert.equal(calls, 1);
});

test("application owns final score and band", () => {
  const normalized = normalizeProviderAssessment(validProviderAssessment());
  const expected = Math.round(
    validDimensions.researchRelevance * DEFAULT_RELEVANCE_WEIGHTS.researchRelevance +
      validDimensions.novelty * DEFAULT_RELEVANCE_WEIGHTS.novelty +
      validDimensions.technologyImpact * DEFAULT_RELEVANCE_WEIGHTS.technologyImpact +
      validDimensions.portfolioUsefulness * DEFAULT_RELEVANCE_WEIGHTS.portfolioUsefulness +
      validDimensions.graduateValue * DEFAULT_RELEVANCE_WEIGHTS.graduateValue +
      validDimensions.communityAttention * DEFAULT_RELEVANCE_WEIGHTS.communityAttention
  );

  assert.equal(normalized.finalScore, expected);
  assert.equal(normalized.band, scoreToBand(expected));
});

test("custom validated weights work for final score", () => {
  const normalized = normalizeProviderAssessment(validProviderAssessment(), {
    weights: {
      researchRelevance: 0.5,
      novelty: 0.1,
      technologyImpact: 0.1,
      portfolioUsefulness: 0.1,
      graduateValue: 0.1,
      communityAttention: 0.1,
    },
  });

  assert.equal(normalized.finalScore, 64);
});

test("confidence normalization is bounded and deterministic", () => {
  const first = normalizeProviderAssessment(
    validProviderAssessment({
      technologies: [{ technology: "Unknown", confidence: 0.5, evidence: ["x"] }],
      warnings: ["missing metrics"],
    })
  );
  const second = normalizeProviderAssessment(
    validProviderAssessment({
      technologies: [{ technology: "Unknown", confidence: 0.5, evidence: ["x"] }],
      warnings: ["missing metrics"],
    })
  );
  const complete = normalizeProviderAssessment(validProviderAssessment());

  assert.ok(first.normalizedConfidence >= 0 && first.normalizedConfidence <= 1);
  assert.deepEqual(first.normalizedConfidence, second.normalizedConfidence);
  assert.ok(first.normalizedConfidence < complete.normalizedConfidence);
});

function mockClient(signalFound = true) {
  const creates: SignalRelevanceAssessmentCreateInput[] = [];
  const client: AssessmentPersistenceClient = {
    signal: {
      async findUnique() {
        if (!signalFound) return null;
        return {
          id: "sig_1",
          title: "Underwater archaeology NeRF dataset",
          summary: "Dataset with repository.",
          canonicalUrl: "https://example.com/signal",
          signalType: "DATASET",
          sourceName: "OpenHeritage3D",
          publishedAt: new Date("2026-06-01T00:00:00.000Z"),
          technologies: ["NeRF"],
          organizations: ["OpenHeritage3D"],
          researchers: ["Ada Researcher"],
          domains: ["marine archaeology"],
          keywords: ["dataset"],
          raw: { safe: true },
        };
      },
    },
    signalRelevanceAssessment: {
      async create(args) {
        creates.push(args.data);
        return {
          ...args.data,
          id: `assessment_${creates.length}`,
          createdAt: new Date("2026-07-01T00:00:00.000Z"),
        } satisfies StoredAssessmentRecord;
      },
    },
  };
  return { client, creates };
}

function mockProvider(result: ProviderRelevanceAssessment = validProviderAssessment()): RelevanceAssessmentProvider {
  return {
    provider: "nvidia",
    model: "model",
    version: "1.0.0",
    async assess() {
      return {
        assessment: result,
        rawResponse: { redacted: true },
        requestMetadata: { durationMs: 5, retryCount: 0, providerRequestId: "request_1" },
      };
    },
  };
}

test("successful assessment is stored without overwriting previous assessments", async () => {
  const { client, creates } = mockClient();
  const first = await assessSignalWithNvidia("sig_1", {
    client,
    provider: mockProvider(),
    storeRawResponse: false,
  });
  const second = await assessSignalWithNvidia("sig_1", {
    client,
    provider: mockProvider(),
    storeRawResponse: false,
  });

  assert.equal(first.status, "success");
  assert.equal(second.status, "success");
  assert.equal(creates.length, 2);
  assert.equal(creates[0].rawResponseJson, null);
  assert.equal(creates[0].providerVersion, "1.0.0");
});

test("failure assessment is stored and unknown Signal ID fails", async () => {
  const { client, creates } = mockClient();
  const provider: RelevanceAssessmentProvider = {
    provider: "nvidia",
    model: "model",
    version: "1.0.0",
    async assess() {
      throw new NvidiaSchemaValidationError(["bad"]);
    },
  };

  await assert.rejects(() => assessSignalWithNvidia("sig_1", { client, provider }));
  assert.equal(creates.length, 1);
  assert.equal(creates[0].status, "failed");
  assert.equal(creates[0].errorCode, "schema_validation_error");

  await assert.rejects(() =>
    assessSignalWithNvidia("missing", { client: mockClient(false).client, provider })
  );
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
