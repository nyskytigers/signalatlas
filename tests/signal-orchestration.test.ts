import assert from "node:assert/strict";
import {
  decideSignalProcessingAction,
  processNormalizedItemAsSignal,
  SignalProcessingError,
  type DuplicateMatch,
  type MinimalExistingSignal,
  type NormalizedSignalItem,
} from "../lib/signals";

function test(name: string, fn: () => void) {
  fn();
  console.log(`ok - ${name}`);
}

function normalizedItem(
  overrides: Partial<NormalizedSignalItem> = {}
): NormalizedSignalItem {
  return {
    sourceType: "RSS",
    sourceName: "Research Feed",
    url: "https://example.com/signals/auv-photogrammetry",
    title: "AUV photogrammetry survey maps a submerged harbor",
    summary:
      "WHOI and MBARI used an autonomous underwater vehicle for marine archaeology.",
    tags: ["dataset"],
    raw: { externalId: "item-1" },
    ...overrides,
  };
}

function existing(
  overrides: Partial<MinimalExistingSignal> = {}
): MinimalExistingSignal {
  return {
    id: "existing_1",
    title: "Unrelated signal about haptics",
    canonicalUrl: "https://existing.example.com/signal",
    raw: { externalId: "different" },
    signalType: "NEWS",
    ...overrides,
  };
}

test("a unique NormalizedItem produces action create", () => {
  const result = processNormalizedItemAsSignal(normalizedItem(), []);

  assert.equal(result.action, "create");
  assert.equal(result.stage, "completed");
  assert.equal(result.duplicate.isDuplicate, false);
  assert.ok(result.reasons.includes("No duplicate candidate matched."));
});

test("normalization happens before entity extraction", () => {
  const result = processNormalizedItemAsSignal(
    normalizedItem({
      title: "Dataset record",
      summary: null,
      tags: ["virtual reality"],
    })
  );

  assert.deepEqual(result.signal.keywords, ["virtual reality"]);
  assert.deepEqual(result.entities.technologies, ["VR"]);
  assert.deepEqual(result.signal.technologies, ["VR"]);
});

test("technology aliases enrich the Signal", () => {
  const result = processNormalizedItemAsSignal(
    normalizedItem({
      title: "Underwater vehicle survey",
      summary:
        "An autonomous underwater vehicle collected side scan sonar and neural radiance fields.",
    })
  );

  assert.deepEqual(result.signal.technologies, ["AUV", "NeRF", "Side-Scan Sonar"]);
});

test("organization aliases enrich the Signal", () => {
  const result = processNormalizedItemAsSignal(
    normalizedItem({
      summary: "WHOI and MBARI released a sonar dataset.",
    })
  );

  assert.deepEqual(result.signal.organizations, [
    "Monterey Bay Aquarium Research Institute",
    "Woods Hole Oceanographic Institution",
  ]);
});

test("exact identifier duplicate produces update", () => {
  const result = processNormalizedItemAsSignal(
    normalizedItem({ raw: { doi: "10.1000/example" } }),
    [existing({ id: "doi_1", raw: { DOI: "https://doi.org/10.1000/EXAMPLE" } })]
  );

  assert.equal(result.action, "update");
  assert.equal(result.duplicate.matchedBy, "identifier");
  assert.ok(result.reasons.includes("Exact identifier match found."));
});

test("exact URL duplicate produces update", () => {
  const result = processNormalizedItemAsSignal(
    normalizedItem({
      url: "https://example.com/article/?utm_source=news&id=7",
      raw: { externalId: "new" },
    }),
    [
      existing({
        id: "url_1",
        canonicalUrl: "https://example.com/article?id=7",
      }),
    ]
  );

  assert.equal(result.action, "update");
  assert.equal(result.duplicate.matchedBy, "url");
  assert.ok(
    result.reasons.includes("Canonical URL matched an existing signal.")
  );
});

test("exact title duplicate produces review", () => {
  const result = processNormalizedItemAsSignal(
    normalizedItem({
      title: "ROV maps a submerged harbor!",
      url: "https://example.com/new-url",
      raw: { externalId: "new-title" },
    }),
    [
      existing({
        id: "title_1",
        title: "rov maps a submerged harbor",
      }),
    ]
  );

  assert.equal(result.action, "review");
  assert.equal(result.duplicate.matchedBy, "title");
  assert.equal(result.duplicate.confidence, "exact");
  assert.ok(result.reasons.includes("Normalized title matched exactly."));
});

test("high title similarity produces review", () => {
  const title =
    "Deep ocean autonomous robot navigation with sonar maps for long duration missions";
  const similarTitle =
    "Deep ocean autonomous robot navigation with sonar maps for long duration field missions";
  const result = processNormalizedItemAsSignal(
    normalizedItem({
      title,
      url: "https://example.com/high-similarity",
      raw: { externalId: "similar-new" },
    }),
    [existing({ id: "similar_1", title: similarTitle })]
  );

  assert.equal(result.action, "review");
  assert.equal(result.duplicate.matchedBy, "title");
  assert.equal(result.duplicate.confidence, "high");
  assert.ok(result.reasons.includes("Title similarity exceeded 0.92."));
});

test("unrelated existing signals still produce create", () => {
  const result = processNormalizedItemAsSignal(normalizedItem(), [
    existing({ title: "XR hand tracking evaluation", raw: { externalId: "xr" } }),
  ]);

  assert.equal(result.action, "create");
  assert.equal(result.duplicate.matchedBy, "none");
});

test("empty existing signal list works", () => {
  const result = processNormalizedItemAsSignal(normalizedItem(), []);

  assert.equal(result.action, "create");
  assert.equal(result.metrics.duplicateScore, undefined);
});

test("missing optional fields do not crash", () => {
  const result = processNormalizedItemAsSignal({
    sourceType: "RSS",
    url: "https://example.com/minimal",
    title: "Minimal signal",
  });

  assert.equal(result.action, "create");
  assert.equal(result.signal.summary, null);
  assert.deepEqual(result.signal.technologies, []);
});

test("raw metadata survives the full pipeline", () => {
  const raw = { externalId: "raw-1", creators: ["Grace Hopper"] };
  const result = processNormalizedItemAsSignal(normalizedItem({ raw }));

  assert.deepEqual(result.signal.raw, raw);
  assert.deepEqual(result.signal.researchers, ["Grace Hopper"]);
});

test("existing signal arrays are preserved during enrichment", () => {
  const result = processNormalizedItemAsSignal(
    normalizedItem({
      title: "ROV mission by WHOI",
      summary: null,
      technologies: ["Existing Tech"],
      organizations: ["Existing Org"],
      researchers: ["Existing Researcher"],
    })
  );

  assert.deepEqual(result.signal.technologies, ["Existing Tech", "ROV"]);
  assert.deepEqual(result.signal.organizations, [
    "Existing Org",
    "Woods Hole Oceanographic Institution",
  ]);
  assert.deepEqual(result.signal.researchers, ["Existing Researcher"]);
});

test("extracted values merge without duplicates", () => {
  const result = processNormalizedItemAsSignal(
    normalizedItem({
      title: "MBARI ROV mission",
      summary: null,
      technologies: ["rov"],
      organizations: ["monterey bay aquarium research institute"],
      raw: { authors: ["Grace Hopper"] },
    })
  );

  assert.deepEqual(result.signal.technologies, ["rov"]);
  assert.deepEqual(result.signal.organizations, [
    "monterey bay aquarium research institute",
  ]);
  assert.deepEqual(result.signal.researchers, ["Grace Hopper"]);
});

test("input NormalizedItem is not mutated", () => {
  const item = normalizedItem({
    raw: { creators: ["Grace Hopper"] },
    tags: ["virtual reality"],
  });
  const snapshot = structuredClone(item);

  processNormalizedItemAsSignal(item);

  assert.deepEqual(item, snapshot);
});

test("existingSignals input is not mutated", () => {
  const existingSignals = [
    existing({
      title: "ROV maps a submerged harbor",
      raw: { externalId: "existing-title" },
    }),
  ];
  const snapshot = structuredClone(existingSignals);

  processNormalizedItemAsSignal(
    normalizedItem({
      title: "ROV maps a submerged harbor!",
      url: "https://example.com/non-mutating",
      raw: { externalId: "new-title" },
    }),
    existingSignals
  );

  assert.deepEqual(existingSignals, snapshot);
});

test("output ordering is deterministic", () => {
  const item = normalizedItem({
    title: "NOAA and MBARI use ROV photogrammetry on E/V Nautilus",
    summary: "WHOI contributes AUV navigation metadata.",
  });

  const first = processNormalizedItemAsSignal(item);
  const second = processNormalizedItemAsSignal(item);

  assert.deepEqual(first, second);
  assert.deepEqual(first.signal.technologies, ["AUV", "Photogrammetry", "ROV"]);
  assert.deepEqual(first.signal.organizations, [
    "Monterey Bay Aquarium Research Institute",
    "NOAA",
    "Woods Hole Oceanographic Institution",
  ]);
});

test("reasons accurately describe the decision", () => {
  const result = processNormalizedItemAsSignal(
    normalizedItem({ raw: { externalId: "same-id" } }),
    [existing({ raw: { external_id: "same-id" } })]
  );

  assert.deepEqual(result.reasons, [
    "Entity enrichment added 2 technologies, 2 organizations, and 0 researchers.",
    "Exact identifier match found.",
    "Action selected: update.",
  ]);
});

test("end-to-end normalized item produces enriched duplicate decision", () => {
  const result = processNormalizedItemAsSignal(
    normalizedItem({
      sourceType: "ARXIV",
      sourceName: "arXiv",
      url: "https://arxiv.org/abs/2607.00001",
      title:
        "Gaussian splats and photogrammetry for Antikythera wreck digital twins",
      summary:
        "UNESCO Underwater Cultural Heritage teams used neural radiance fields.",
      authors: ["Dr. Ada Lovelace"],
      tags: ["marine archaeology", "digital twin"],
      raw: { externalId: "arxiv:2607.00001" },
    }),
    [existing({ raw: { externalId: "different" } })]
  );

  assert.equal(result.signal.signalType, "PAPER");
  assert.equal(result.action, "create");
  assert.deepEqual(result.signal.technologies, [
    "Digital Twin",
    "Gaussian Splatting",
    "NeRF",
    "Photogrammetry",
  ]);
  assert.deepEqual(result.entities.archaeologicalSites, [
    "Antikythera Shipwreck",
  ]);
  assert.deepEqual(result.signal.organizations, [
    "UNESCO",
    "UNESCO Underwater Cultural Heritage",
  ]);
  assert.deepEqual(result.signal.researchers, ["Dr. Ada Lovelace"]);
});

test("missing title throws SignalProcessingError", () => {
  assert.throws(
    () =>
      processNormalizedItemAsSignal({
        sourceType: "RSS",
        url: "https://example.com/missing-title",
        title: "",
      }),
    (error) =>
      error instanceof SignalProcessingError && error.code === "MISSING_TITLE"
  );
});

test("decision helper keeps duplicate rules centralized", () => {
  const duplicate: DuplicateMatch = {
    isDuplicate: true,
    confidence: "exact",
    matchedBy: "url",
    reason: "Canonical URL matched after normalization.",
  };

  assert.equal(decideSignalProcessingAction(duplicate), "update");
});
