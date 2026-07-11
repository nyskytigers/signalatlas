import assert from "node:assert/strict";
import {
  calculateTitleSimilarity,
  findDuplicateSignal,
  getSignalIdentifiers,
  hashUrl,
  normalizeUrlForDedupe,
  type MinimalExistingSignal,
  type SignalInput,
} from "../lib/signals";

function test(name: string, fn: () => void) {
  fn();
  console.log(`ok - ${name}`);
}

function signal(overrides: Partial<SignalInput> = {}): SignalInput {
  return {
    title: "Autonomous Ocean Robot Navigation",
    summary: null,
    sourceId: null,
    sourceName: null,
    canonicalUrl: "https://example.com/research/ocean-robot",
    signalType: "NEWS",
    publishedAt: null,
    technologies: [],
    organizations: [],
    researchers: [],
    domains: [],
    keywords: [],
    relevanceScore: null,
    raw: null,
    ...overrides,
  };
}

function existing(
  overrides: Partial<MinimalExistingSignal> = {}
): MinimalExistingSignal {
  return {
    id: "existing_1",
    title: "A Different Existing Signal",
    canonicalUrl: "https://existing.example.com/signal",
    raw: null,
    signalType: "NEWS",
    ...overrides,
  };
}

test("URL normalization removes tracking params", () => {
  assert.equal(
    normalizeUrlForDedupe(
      "https://Example.com/path?utm_source=newsletter&id=42&gclid=abc"
    ),
    "https://example.com/path?id=42"
  );
});

test("URL normalization handles trailing slash", () => {
  assert.equal(
    normalizeUrlForDedupe("https://Example.com/path/to/article/"),
    "https://example.com/path/to/article"
  );
});

test("URL hash is stable", () => {
  assert.equal(
    hashUrl("https://example.com/article/?utm_campaign=launch"),
    hashUrl("https://EXAMPLE.com/article")
  );
});

test("DOI and external identifiers are extracted safely", () => {
  assert.deepEqual(
    getSignalIdentifiers(
      signal({
        raw: {
          DOI: "https://doi.org/10.1000/ABC.123",
          nested: { external_id: " Record-42 " },
        },
      })
    ),
    ["doi:10.1000/abc.123", "externalId:record-42"]
  );
});

test("DOI exact match detects duplicate", () => {
  const match = findDuplicateSignal(
    signal({ raw: { doi: "10.1000/example" } }),
    [
      existing({
        id: "paper_1",
        raw: { DOI: "https://doi.org/10.1000/EXAMPLE" },
      }),
    ]
  );

  assert.equal(match.isDuplicate, true);
  assert.equal(match.confidence, "exact");
  assert.equal(match.matchedBy, "identifier");
  assert.equal(match.existingSignalId, "paper_1");
});

test("external identifier exact match detects duplicate", () => {
  const match = findDuplicateSignal(
    signal({ raw: { externalId: "repo:example/project" } }),
    [
      existing({
        id: "repo_1",
        raw: { external_id: " repo:EXAMPLE/project " },
      }),
    ]
  );

  assert.equal(match.isDuplicate, true);
  assert.equal(match.matchedBy, "identifier");
});

test("normalized URL match detects duplicate", () => {
  const match = findDuplicateSignal(
    signal({
      canonicalUrl:
        "https://Example.com/articles/robotics/?utm_medium=social&id=100",
    }),
    [
      existing({
        id: "url_1",
        canonicalUrl: "https://example.com/articles/robotics?id=100",
      }),
    ]
  );

  assert.equal(match.isDuplicate, true);
  assert.equal(match.matchedBy, "url");
  assert.equal(match.existingSignalId, "url_1");
});

test("exact normalized title detects duplicate", () => {
  const match = findDuplicateSignal(
    signal({ title: "Autonomous Ocean Robot Navigation!" }),
    [existing({ id: "title_1", title: "autonomous ocean robot navigation" })]
  );

  assert.equal(match.isDuplicate, true);
  assert.equal(match.matchedBy, "title");
  assert.equal(match.confidence, "exact");
  assert.equal(match.score, 1);
});

test("high title similarity detects likely duplicate", () => {
  const title =
    "Deep ocean autonomous robot navigation with sonar maps for long duration missions";
  const similarTitle =
    "Deep ocean autonomous robot navigation with sonar maps for long duration field missions";

  assert.ok(calculateTitleSimilarity(title, similarTitle) >= 0.92);

  const match = findDuplicateSignal(signal({ title }), [
    existing({ id: "similar_1", title: similarTitle }),
  ]);

  assert.equal(match.isDuplicate, true);
  assert.equal(match.matchedBy, "title");
  assert.equal(match.confidence, "high");
});

test("unrelated title does not match", () => {
  const match = findDuplicateSignal(
    signal({ title: "New coral reef expedition dataset released" }),
    [
      existing({
        title: "Wearable haptic gloves for virtual reality interaction",
      }),
    ]
  );

  assert.equal(match.isDuplicate, false);
  assert.equal(match.matchedBy, "none");
  assert.equal(match.confidence, "none");
});

test("invalid URL does not crash", () => {
  assert.equal(
    normalizeUrlForDedupe("not a url/?utm_source=x&keep=yes/"),
    "not a url?keep=yes%2F"
  );

  const match = findDuplicateSignal(
    signal({ canonicalUrl: "not a url/?utm_source=x&keep=yes/" }),
    [existing({ canonicalUrl: "not a url?keep=yes%2F" })]
  );

  assert.equal(match.isDuplicate, true);
  assert.equal(match.matchedBy, "url");
});

test("empty or missing raw metadata does not crash", () => {
  assert.deepEqual(getSignalIdentifiers(signal({ raw: null })), []);
  assert.deepEqual(getSignalIdentifiers(signal({ raw: {} })), []);

  const match = findDuplicateSignal(signal({ raw: null }), [
    existing({ raw: undefined }),
  ]);

  assert.equal(match.isDuplicate, false);
});
