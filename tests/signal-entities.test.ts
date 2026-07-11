import assert from "node:assert/strict";
import {
  applyExtractedEntitiesToSignal,
  extractSignalEntities,
  type SignalInput,
} from "../lib/signals";

function test(name: string, fn: () => void) {
  fn();
  console.log(`ok - ${name}`);
}

function signal(overrides: Partial<SignalInput> = {}): SignalInput {
  return {
    title: "Marine archaeology signal",
    summary: null,
    sourceId: null,
    sourceName: null,
    canonicalUrl: "https://example.com/signal",
    signalType: "DISCOVERY",
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

test("exact technology match", () => {
  const result = extractSignalEntities(
    signal({
      title: "ROV survey documents a deep reef",
    })
  );

  assert.deepEqual(result.technologies, ["ROV"]);
});

test("technology alias maps to canonical name", () => {
  const result = extractSignalEntities(
    signal({
      summary:
        "The autonomous underwater vehicle collected side scan sonar and neural radiance fields imagery.",
    })
  );

  assert.deepEqual(result.technologies, ["AUV", "NeRF", "Side-Scan Sonar"]);
});

test("whole-word matching avoids substring false positives", () => {
  const result = extractSignalEntities(
    signal({
      title: "Islamic ceramics from a coastal port",
      summary: "The archive mentions lidarless processing and spar buoys.",
    })
  );

  assert.equal(result.technologies.includes("SLAM"), false);
  assert.equal(result.technologies.includes("LiDAR"), false);
  assert.equal(result.technologies.includes("AR"), false);
});

test("organization alias maps to canonical organization", () => {
  const result = extractSignalEntities(
    signal({
      title: "UNESCO UCH releases a marine heritage update",
    })
  );

  assert.deepEqual(result.organizations, [
    "UNESCO",
    "UNESCO Underwater Cultural Heritage",
  ]);
});

test("WHOI and MBARI extraction", () => {
  const result = extractSignalEntities(
    signal({
      summary:
        "WHOI and MBARI collaborated on multibeam sonar mapping for a deep-sea robot.",
    })
  );

  assert.deepEqual(result.institutions, [
    "Woods Hole Oceanographic Institution",
  ]);
  assert.deepEqual(result.labs, ["Monterey Bay Aquarium Research Institute"]);
});

test("vessel alias maps to canonical vessel name", () => {
  const result = extractSignalEntities(
    signal({
      title: "RV Falkor too completes a bathymetry transect",
    })
  );

  assert.deepEqual(result.vessels, ["R/V Falkor (too)"]);
});

test("researcher extraction from explicit metadata", () => {
  const result = extractSignalEntities(
    signal({
      raw: {
        creators: [{ name: " Dr. Ada Lovelace " }, { full_name: "Grace Hopper" }],
      },
    })
  );

  assert.deepEqual(result.researchers, ["Dr. Ada Lovelace", "Grace Hopper"]);
});

test("duplicate entities collapse correctly", () => {
  const result = extractSignalEntities(
    signal({
      title: "MBARI deploys an ROV",
      summary:
        "Monterey Bay Aquarium Research Institute teams used a remotely operated vehicle.",
    })
  );

  assert.deepEqual(result.labs, ["Monterey Bay Aquarium Research Institute"]);
  assert.deepEqual(result.technologies, ["ROV"]);
  assert.equal(
    result.entities.filter((entity) => entity.canonicalName === "ROV").length,
    1
  );
});

test("existing Signal arrays are preserved during enrichment", () => {
  const input = signal({
    title: "ROV dive with WHOI",
    technologies: ["Existing Tech"],
    organizations: ["Existing Org"],
    researchers: ["Existing Researcher"],
  });

  const enriched = applyExtractedEntitiesToSignal(input);

  assert.deepEqual(enriched.technologies, ["Existing Tech", "ROV"]);
  assert.deepEqual(enriched.organizations, [
    "Existing Org",
    "Woods Hole Oceanographic Institution",
  ]);
  assert.deepEqual(enriched.researchers, ["Existing Researcher"]);
});

test("extracted arrays merge without duplicates", () => {
  const enriched = applyExtractedEntitiesToSignal(
    signal({
      title: "MBARI ROV mission",
      technologies: ["rov"],
      organizations: ["monterey bay aquarium research institute"],
      researchers: ["Grace Hopper"],
      raw: { authors: ["Grace Hopper"] },
    })
  );

  assert.deepEqual(enriched.technologies, ["rov"]);
  assert.deepEqual(enriched.organizations, [
    "monterey bay aquarium research institute",
  ]);
  assert.deepEqual(enriched.researchers, ["Grace Hopper"]);
});

test("null summary and empty keywords do not crash", () => {
  const result = extractSignalEntities(
    signal({
      title: "Photogrammetry update",
      summary: null,
      keywords: [],
    })
  );

  assert.deepEqual(result.technologies, ["Photogrammetry"]);
});

test("malformed or nested raw metadata does not crash", () => {
  const result = extractSignalEntities(
    signal({
      raw: {
        note: null,
        count: 42,
        ignoredArray: ["MBARI"],
        nested: {
          nested: {
            nested: {
              tooDeep: "ROV",
            },
          },
        },
        metadata: {
          publisher: "Zenodo",
        },
      },
    })
  );

  assert.deepEqual(result.organizations, ["Zenodo"]);
  assert.deepEqual(result.technologies, []);
});

test("output ordering is deterministic", () => {
  const first = extractSignalEntities(
    signal({
      title: "NOAA and MBARI use ROV photogrammetry on E/V Nautilus",
    })
  );
  const second = extractSignalEntities(
    signal({
      title: "NOAA and MBARI use ROV photogrammetry on E/V Nautilus",
    })
  );

  assert.deepEqual(first, second);
  assert.deepEqual(first.technologies, ["Photogrammetry", "ROV"]);
  assert.deepEqual(first.vessels, ["E/V Nautilus"]);
});

test("input Signal is not mutated", () => {
  const input = signal({
    title: "AUV mission by WHOI",
    technologies: ["Existing Tech"],
    organizations: [],
    raw: { authors: ["Grace Hopper"] },
  });
  const snapshot = structuredClone(input);

  applyExtractedEntitiesToSignal(input);

  assert.deepEqual(input, snapshot);
});
