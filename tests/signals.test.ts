import assert from "node:assert/strict";
import {
  SIGNAL_TYPES,
  isSignalType,
  normalizedItemToSignal,
} from "../lib/signals";

function test(name: string, fn: () => void) {
  fn();
  console.log(`ok - ${name}`);
}

test("Signal type constants are valid", () => {
  assert.ok(SIGNAL_TYPES.includes("PAPER"));
  assert.ok(SIGNAL_TYPES.includes("REPORT"));
  assert.ok(isSignalType("DATASET"));
  assert.equal(isSignalType("UNKNOWN"), false);
});

test("NormalizedItem converts into Signal", () => {
  const publishedAt = new Date("2026-02-10T12:00:00.000Z");
  const signal = normalizedItemToSignal({
    sourceId: "src_123",
    sourceType: "ARXIV",
    sourceName: "arXiv",
    url: "https://arxiv.org/abs/2602.00001",
    title: "A Robotics Paper",
    summary: "A useful summary",
    publishedAt,
    authors: ["Ada Researcher"],
    tags: ["robotics", "ocean"],
    raw: { id: "2602.00001" },
  });

  assert.deepEqual(signal, {
    title: "A Robotics Paper",
    summary: "A useful summary",
    sourceId: "src_123",
    sourceName: "arXiv",
    canonicalUrl: "https://arxiv.org/abs/2602.00001",
    signalType: "PAPER",
    publishedAt,
    technologies: [],
    organizations: [],
    researchers: ["Ada Researcher"],
    domains: [],
    keywords: ["robotics", "ocean"],
    relevanceScore: null,
    raw: { id: "2602.00001" },
  });
});

test("missing optional fields become null or []", () => {
  const signal = normalizedItemToSignal({
    sourceType: "RSS",
    url: "https://example.com/news",
    title: "Brief update",
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

test("dataset-like input maps to DATASET", () => {
  const signal = normalizedItemToSignal({
    sourceType: "WEBSITE",
    url: "https://zenodo.org/records/123",
    title: "New underwater navigation dataset",
  });

  assert.equal(signal.signalType, "DATASET");
});

test("repository-like input maps to REPOSITORY", () => {
  const signal = normalizedItemToSignal({
    sourceType: "GITHUB",
    url: "https://github.com/example/project",
    title: "example/project repository activity",
  });

  assert.equal(signal.signalType, "REPOSITORY");
});

test("fallback type is NEWS", () => {
  const signal = normalizedItemToSignal({
    sourceType: "RSS",
    url: "https://example.com/latest",
    title: "Lab posts a short note",
  });

  assert.equal(signal.signalType, "NEWS");
});
