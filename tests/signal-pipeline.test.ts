import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import type { Signal as PersistedSignal } from "@prisma/client";
import {
  buildSignalFromNormalizedItem,
  ingestNormalizedItemAsSignal,
  persistSignal,
  type SignalInput,
  type SignalPersistenceClient,
} from "../lib/signals";

function test(name: string, fn: () => void | Promise<void>) {
  Promise.resolve(fn())
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

function persistedSignalFrom(input: SignalInput): PersistedSignal {
  const now = new Date("2026-03-01T00:00:00.000Z");

  return {
    id: input.id ?? "signal_1",
    title: input.title,
    summary: input.summary,
    canonicalUrl: input.canonicalUrl,
    signalType: input.signalType,
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    publishedAt: input.publishedAt,
    technologies: input.technologies,
    organizations: input.organizations,
    researchers: input.researchers,
    domains: input.domains,
    keywords: input.keywords,
    relevanceScore: input.relevanceScore,
    raw: input.raw as Prisma.JsonValue,
    createdAt: now,
    updatedAt: now,
  };
}

test("buildSignalFromNormalizedItem returns a valid SignalInput", () => {
  const signal = buildSignalFromNormalizedItem({
    sourceId: "source_1",
    sourceType: "ARXIV",
    sourceName: "arXiv",
    url: "https://arxiv.org/abs/2603.00001",
    title: "A canonical signal",
    description: "Converted from normalized ingestion output",
    authors: ["Grace Researcher"],
    tags: ["robotics"],
  });

  assert.equal(signal.title, "A canonical signal");
  assert.equal(signal.summary, "Converted from normalized ingestion output");
  assert.equal(signal.sourceId, "source_1");
  assert.equal(signal.sourceName, "arXiv");
  assert.equal(signal.canonicalUrl, "https://arxiv.org/abs/2603.00001");
  assert.equal(signal.signalType, "PAPER");
  assert.deepEqual(signal.researchers, ["Grace Researcher"]);
  assert.deepEqual(signal.keywords, ["robotics"]);
});

test("missing optional fields remain null or []", () => {
  const signal = buildSignalFromNormalizedItem({
    sourceType: "RSS",
    url: "https://example.com/post",
    title: "A short post",
  });

  assert.equal(signal.summary, null);
  assert.equal(signal.sourceId, null);
  assert.equal(signal.sourceName, null);
  assert.equal(signal.publishedAt, null);
  assert.deepEqual(signal.technologies, []);
  assert.deepEqual(signal.organizations, []);
  assert.deepEqual(signal.researchers, []);
  assert.deepEqual(signal.domains, []);
  assert.deepEqual(signal.keywords, []);
  assert.equal(signal.relevanceScore, null);
  assert.equal(signal.raw, null);
});

test("canonicalUrl and raw metadata are preserved", () => {
  const raw = { externalId: "abc", nested: { ok: true } };
  const signal = buildSignalFromNormalizedItem({
    sourceType: "WEBSITE",
    canonicalUrl: "https://example.com/canonical",
    url: "https://example.com/tracking",
    title: "Canonical first",
    raw,
  });

  assert.equal(signal.canonicalUrl, "https://example.com/canonical");
  assert.deepEqual(signal.raw, raw);
});

test("persistSignal uses canonicalUrl upsert without a real database", async () => {
  let upsertArgs: unknown;
  const signal: SignalInput = {
    title: "Dataset release",
    summary: null,
    sourceId: null,
    sourceName: "Example Lab",
    canonicalUrl: "https://zenodo.org/records/42",
    signalType: "DATASET",
    publishedAt: null,
    technologies: ["sonar"],
    organizations: ["Example Lab"],
    researchers: [],
    domains: ["marine"],
    keywords: ["dataset"],
    relevanceScore: null,
    raw: { record: 42 },
  };

  const client: SignalPersistenceClient = {
    signal: {
      async upsert(args) {
        upsertArgs = args;
        return persistedSignalFrom(signal);
      },
    },
  };

  await persistSignal(signal, client);

  assert.deepEqual(upsertArgs, {
    where: { canonicalUrl: "https://zenodo.org/records/42" },
    create: {
      title: "Dataset release",
      summary: null,
      canonicalUrl: "https://zenodo.org/records/42",
      signalType: "DATASET",
      sourceId: null,
      sourceName: "Example Lab",
      publishedAt: null,
      technologies: ["sonar"],
      organizations: ["Example Lab"],
      researchers: [],
      domains: ["marine"],
      keywords: ["dataset"],
      relevanceScore: null,
      raw: { record: 42 },
    },
    update: {
      title: "Dataset release",
      summary: null,
      canonicalUrl: "https://zenodo.org/records/42",
      signalType: "DATASET",
      sourceId: null,
      sourceName: "Example Lab",
      publishedAt: null,
      technologies: ["sonar"],
      organizations: ["Example Lab"],
      researchers: [],
      domains: ["marine"],
      keywords: ["dataset"],
      relevanceScore: null,
      raw: { record: 42 },
    },
  });
});

test("ingestNormalizedItemAsSignal builds and persists through the mock client", async () => {
  let canonicalUrl: string | undefined;
  const client: SignalPersistenceClient = {
    signal: {
      async upsert(args) {
        canonicalUrl = args.where.canonicalUrl;
        return persistedSignalFrom(args.create as SignalInput);
      },
    },
  };

  await ingestNormalizedItemAsSignal(
    {
      sourceType: "GITHUB",
      url: "https://github.com/example/signalatlas",
      title: "example/signalatlas repository activity",
    },
    client
  );

  assert.equal(canonicalUrl, "https://github.com/example/signalatlas");
});
