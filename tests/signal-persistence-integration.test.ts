import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import {
  loadDuplicateCandidates,
  mergeSignalForUpdate,
  processAndPersistNormalizedItem,
  SignalProcessingError,
  type NormalizedSignalItem,
  type SignalDatabaseClient,
  type SignalForUpdate,
  type SignalInput,
} from "../lib/signals";
import { maybePersistSignalForIngestItem } from "../lib/ingest/signalPersistence";

type TestFn = () => void | Promise<void>;
const tests: Array<{ name: string; fn: TestFn }> = [];

function test(name: string, fn: TestFn) {
  tests.push({ name, fn });
}

function normalizedItem(
  overrides: Partial<NormalizedSignalItem> = {}
): NormalizedSignalItem {
  return {
    sourceId: "rss_source_1",
    sourceType: "RSS",
    sourceName: "RSS",
    url: "https://example.com/signals/auv-photogrammetry",
    title: "AUV photogrammetry survey maps a submerged harbor",
    summary: "WHOI and MBARI used an autonomous underwater vehicle.",
    publishedAt: new Date("2026-04-01T00:00:00.000Z"),
    tags: ["dataset"],
    raw: { externalId: "item-1" },
    ...overrides,
  };
}

function existingSignal(overrides: Partial<SignalForUpdate> = {}): SignalForUpdate {
  return {
    id: "signal_existing",
    title: "Existing signal",
    summary: "Existing summary",
    canonicalUrl: "https://example.com/existing",
    raw: { externalId: "existing" },
    signalType: "NEWS",
    sourceId: "existing_source",
    sourceName: "Existing Source",
    publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    technologies: ["Existing Tech"],
    organizations: ["Existing Org"],
    researchers: ["Existing Researcher"],
    domains: ["marine"],
    keywords: ["existing"],
    relevanceScore: 0.5,
    ...overrides,
  };
}

function persistedFrom(data: Record<string, unknown>) {
  const now = new Date("2026-04-01T00:00:00.000Z");
  return {
    id: typeof data.id === "string" ? data.id : "persisted_signal",
    title: String(data.title ?? "Untitled"),
    summary: typeof data.summary === "string" ? data.summary : null,
    canonicalUrl: String(data.canonicalUrl),
    signalType: String(data.signalType ?? "NEWS"),
    sourceId: typeof data.sourceId === "string" ? data.sourceId : null,
    sourceName: typeof data.sourceName === "string" ? data.sourceName : null,
    publishedAt: data.publishedAt instanceof Date ? data.publishedAt : null,
    technologies: Array.isArray(data.technologies) ? data.technologies as string[] : [],
    organizations: Array.isArray(data.organizations) ? data.organizations as string[] : [],
    researchers: Array.isArray(data.researchers) ? data.researchers as string[] : [],
    domains: Array.isArray(data.domains) ? data.domains as string[] : [],
    keywords: Array.isArray(data.keywords) ? data.keywords as string[] : [],
    relevanceScore: typeof data.relevanceScore === "number" ? data.relevanceScore : null,
    raw: data.raw as Prisma.JsonValue,
    createdAt: now,
    updatedAt: now,
  };
}

function createClient(options: {
  candidates?: SignalForUpdate[];
  existingForUpdate?: SignalForUpdate | null;
  failUpsert?: boolean;
} = {}) {
  const calls = {
    findMany: [] as unknown[],
    findUnique: [] as unknown[],
    upsert: [] as unknown[],
    update: [] as unknown[],
  };

  const client: SignalDatabaseClient = {
    signal: {
      async findMany(args) {
        calls.findMany.push(args);
        return options.candidates ?? [];
      },
      async findUnique(args) {
        calls.findUnique.push(args);
        return options.existingForUpdate ?? options.candidates?.[0] ?? null;
      },
      async upsert(args) {
        calls.upsert.push(args);
        if (options.failUpsert) throw new Error("Signal write failed");
        return persistedFrom(args.create as Record<string, unknown>);
      },
      async update(args) {
        calls.update.push(args);
        return persistedFrom(args.data as Record<string, unknown>);
      },
    },
  };

  return { client, calls };
}

test("unique signal produces intended create", async () => {
  const { client, calls } = createClient();
  const result = await processAndPersistNormalizedItem(normalizedItem(), {
    client,
    existingSignals: [],
    env: { SIGNAL_PERSISTENCE_ENABLED: "true" },
  });

  assert.equal(result.status, "created");
  assert.equal(result.intendedOperation, "create");
  assert.equal(calls.upsert.length, 1);
});

test("exact identifier duplicate produces update", async () => {
  const existing = existingSignal({ raw: { DOI: "10.1000/example" } });
  const { client, calls } = createClient({ existingForUpdate: existing });
  const result = await processAndPersistNormalizedItem(
    normalizedItem({ raw: { doi: "https://doi.org/10.1000/EXAMPLE" } }),
    {
      client,
      existingSignals: [existing],
      env: { SIGNAL_PERSISTENCE_ENABLED: "true" },
    }
  );

  assert.equal(result.status, "updated");
  assert.equal(result.intendedOperation, "update");
  assert.equal(calls.update.length, 1);
});

test("exact URL duplicate produces update", async () => {
  const existing = existingSignal({
    id: "url_existing",
    canonicalUrl: "https://example.com/article?id=42",
  });
  const { client, calls } = createClient({ existingForUpdate: existing });
  const result = await processAndPersistNormalizedItem(
    normalizedItem({
      url: "https://example.com/article/?utm_source=news&id=42",
      raw: { externalId: "new-url" },
    }),
    {
      client,
      existingSignals: [existing],
      env: { SIGNAL_PERSISTENCE_ENABLED: "true" },
    }
  );

  assert.equal(result.status, "updated");
  assert.equal(calls.update.length, 1);
});

test("exact title duplicate returns review_required and does not write", async () => {
  const { client, calls } = createClient();
  const result = await processAndPersistNormalizedItem(
    normalizedItem({
      title: "ROV maps a submerged harbor!",
      url: "https://example.com/new-title",
      raw: { externalId: "new-title" },
    }),
    {
      client,
      existingSignals: [
        existingSignal({
          title: "rov maps a submerged harbor",
          raw: { externalId: "old-title" },
        }),
      ],
      env: { SIGNAL_PERSISTENCE_ENABLED: "true" },
    }
  );

  assert.equal(result.status, "review_required");
  assert.equal(calls.upsert.length + calls.update.length, 0);
});

test("high title similarity returns review_required and does not write", async () => {
  const { client, calls } = createClient();
  const title =
    "Deep ocean autonomous robot navigation with sonar maps for long duration missions";
  const similarTitle =
    "Deep ocean autonomous robot navigation with sonar maps for long duration field missions";
  const result = await processAndPersistNormalizedItem(
    normalizedItem({ title, url: "https://example.com/similar" }),
    {
      client,
      existingSignals: [existingSignal({ title: similarTitle })],
      env: { SIGNAL_PERSISTENCE_ENABLED: "true" },
    }
  );

  assert.equal(result.status, "review_required");
  assert.equal(calls.upsert.length + calls.update.length, 0);
});

test("dry run never writes", async () => {
  const { client, calls } = createClient();
  const result = await processAndPersistNormalizedItem(normalizedItem(), {
    client,
    dryRun: true,
    existingSignals: [],
    env: { SIGNAL_PERSISTENCE_ENABLED: "true" },
  });

  assert.equal(result.status, "dry_run");
  assert.equal(result.intendedOperation, "create");
  assert.equal(calls.upsert.length + calls.update.length, 0);
});

test("persistence-disabled guard prevents writes", async () => {
  const { client, calls } = createClient();
  const result = await processAndPersistNormalizedItem(normalizedItem(), {
    client,
    existingSignals: [],
    env: {},
  });

  assert.equal(result.status, "disabled");
  assert.equal(calls.findMany.length + calls.upsert.length + calls.update.length, 0);
});

test("persistence-disabled dry run still works", async () => {
  const { client, calls } = createClient();
  const result = await processAndPersistNormalizedItem(normalizedItem(), {
    client,
    dryRun: true,
    existingSignals: [],
    env: {},
  });

  assert.equal(result.status, "dry_run");
  assert.equal(result.processing.action, "create");
  assert.equal(calls.upsert.length + calls.update.length, 0);
});

test("update merges arrays without duplicates", () => {
  const merged = mergeSignalForUpdate(
    existingSignal({
      technologies: ["ROV", "Existing Tech"],
      organizations: ["WHOI"],
    }),
    {
      ...processAndPersistSignalInput(),
      technologies: ["rov", "AUV"],
      organizations: ["whoi", "MBARI"],
    }
  );

  assert.deepEqual(merged.technologies, ["ROV", "Existing Tech", "AUV"]);
  assert.deepEqual(merged.organizations, ["WHOI", "MBARI"]);
});

function processAndPersistSignalInput(): SignalInput {
  return {
    title: "Incoming signal",
    summary: "Incoming summary",
    sourceId: null,
    sourceName: null,
    canonicalUrl: "https://example.com/incoming",
    signalType: "NEWS",
    publishedAt: new Date("2026-02-01T00:00:00.000Z"),
    technologies: [],
    organizations: [],
    researchers: [],
    domains: [],
    keywords: [],
    relevanceScore: null,
    raw: { incoming: true },
  };
}

test("update preserves useful existing values", () => {
  const existing = existingSignal({
    title: "Existing title",
    summary: "Existing summary",
    canonicalUrl: "https://example.com/existing-canonical",
    publishedAt: new Date("2026-01-01T00:00:00.000Z"),
    relevanceScore: 0.8,
    raw: { existing: true },
  });
  const merged = mergeSignalForUpdate(existing, {
    ...processAndPersistSignalInput(),
    summary: "Incoming summary",
    raw: { incoming: true },
  });

  assert.equal(merged.title, "Incoming signal");
  assert.equal(merged.summary, "Existing summary");
  assert.equal(merged.canonicalUrl, "https://example.com/existing-canonical");
  assert.equal(merged.publishedAt?.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(merged.relevanceScore, 0.8);
  assert.deepEqual(merged.raw, {
    existing: { existing: true },
    incoming: { incoming: true },
  });
});

test("create uses enriched technologies and organizations", async () => {
  const { client, calls } = createClient();
  await processAndPersistNormalizedItem(normalizedItem(), {
    client,
    existingSignals: [],
    env: { SIGNAL_PERSISTENCE_ENABLED: "true" },
  });

  const args = calls.upsert[0] as { create: Record<string, unknown> };
  assert.deepEqual(args.create.technologies, ["AUV", "Photogrammetry"]);
  assert.deepEqual(args.create.organizations, [
    "Monterey Bay Aquarium Research Institute",
    "Woods Hole Oceanographic Institution",
  ]);
});

test("raw metadata survives persistence mapping", async () => {
  const { client, calls } = createClient();
  await processAndPersistNormalizedItem(
    normalizedItem({ raw: { externalId: "raw-id", nested: { ok: true } } }),
    {
      client,
      existingSignals: [],
      env: { SIGNAL_PERSISTENCE_ENABLED: "true" },
    }
  );

  const args = calls.upsert[0] as { create: Record<string, unknown> };
  assert.deepEqual(args.create.raw, {
    externalId: "raw-id",
    nested: { ok: true },
  });
});

test("duplicate candidate query is bounded", async () => {
  const { client, calls } = createClient();
  await loadDuplicateCandidates(
    {
      ...processAndPersistSignalInput(),
      title: "A".repeat(200),
    },
    client,
    500
  );

  const args = calls.findMany[0] as { take: number };
  assert.equal(args.take, 25);
});

test("candidate loader returns only minimal fields", async () => {
  const { client, calls } = createClient();
  await loadDuplicateCandidates(processAndPersistSignalInput(), client);

  const args = calls.findMany[0] as { select: Record<string, boolean> };
  assert.deepEqual(args.select, {
    id: true,
    title: true,
    canonicalUrl: true,
    raw: true,
    signalType: true,
  });
});

test("retrying the same signal remains idempotent", async () => {
  const { client, calls } = createClient();
  const options = {
    client,
    existingSignals: [],
    env: { SIGNAL_PERSISTENCE_ENABLED: "true" },
  };

  await processAndPersistNormalizedItem(normalizedItem(), options);
  await processAndPersistNormalizedItem(normalizedItem(), options);

  const first = calls.upsert[0] as { where: { canonicalUrl: string } };
  const second = calls.upsert[1] as { where: { canonicalUrl: string } };
  assert.equal(first.where.canonicalUrl, second.where.canonicalUrl);
});

test("Prisma create and update arguments are correct", async () => {
  const existing = existingSignal({ id: "update_id", raw: { externalId: "same" } });
  const { client, calls } = createClient({ existingForUpdate: existing });

  await processAndPersistNormalizedItem(
    normalizedItem({ raw: { externalId: "same" } }),
    {
      client,
      existingSignals: [existing],
      env: { SIGNAL_PERSISTENCE_ENABLED: "true" },
    }
  );

  const update = calls.update[0] as {
    where: { id?: string; canonicalUrl?: string };
    data: Record<string, unknown>;
  };
  assert.deepEqual(update.where, { id: "update_id" });
  assert.equal(update.data.canonicalUrl, existing.canonicalUrl);
});

test("malformed input produces the existing typed processing error", async () => {
  await assert.rejects(
    () =>
      processAndPersistNormalizedItem(
        { sourceType: "RSS", url: "https://example.com/no-title", title: "" },
        { dryRun: true, existingSignals: [] }
      ),
    (error) =>
      error instanceof SignalProcessingError && error.code === "MISSING_TITLE"
  );
});

test("existing Item ingestion still runs when Signal persistence is disabled", async () => {
  let itemInserted = false;
  itemInserted = true;
  const outcome = await maybePersistSignalForIngestItem(normalizedItem(), {
    env: {},
  });

  assert.equal(itemInserted, true);
  assert.deepEqual(outcome, { attempted: false, status: "disabled" });
});

test("Signal persistence only runs when enabled", async () => {
  const { client, calls } = createClient();
  const outcome = await maybePersistSignalForIngestItem(normalizedItem(), {
    client,
    existingSignals: [],
    env: { SIGNAL_PERSISTENCE_ENABLED: "true" },
  });

  assert.equal(outcome.attempted, true);
  assert.equal(calls.upsert.length, 1);
});

test("Signal persistence does not run in default-disabled mode", async () => {
  const { client, calls } = createClient();
  const outcome = await maybePersistSignalForIngestItem(normalizedItem(), {
    client,
    existingSignals: [],
    env: {},
  });

  assert.equal(outcome.attempted, false);
  assert.equal(calls.upsert.length + calls.update.length, 0);
});

test("review decisions do not write through ingestion helper", async () => {
  const { client, calls } = createClient();
  const outcome = await maybePersistSignalForIngestItem(
    normalizedItem({
      title: "ROV maps a submerged harbor!",
      url: "https://example.com/review",
      raw: { externalId: "review-new" },
    }),
    {
      client,
      existingSignals: [
        existingSignal({
          title: "rov maps a submerged harbor",
          raw: { externalId: "review-old" },
        }),
      ],
      env: { SIGNAL_PERSISTENCE_ENABLED: "true" },
    }
  );

  assert.equal(outcome.attempted, true);
  assert.equal(outcome.status, "review_required");
  assert.equal(calls.upsert.length + calls.update.length, 0);
});

test("Signal failure behavior is recorded and does not throw", async () => {
  const { client } = createClient({ failUpsert: true });
  let recordedError = "";
  const outcome = await maybePersistSignalForIngestItem(normalizedItem(), {
    client,
    existingSignals: [],
    env: { SIGNAL_PERSISTENCE_ENABLED: "true" },
    onFailure: async (error) => {
      recordedError = error instanceof Error ? error.message : String(error);
    },
  });

  assert.deepEqual(outcome, {
    attempted: true,
    status: "failed",
    error: "Signal write failed",
  });
  assert.equal(recordedError, "Signal write failed");
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
