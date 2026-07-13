import assert from "node:assert/strict";
import {
  calculateDeterministicRelevance,
  DEFAULT_RELEVANCE_WEIGHTS,
  extractRelevanceFeatures,
  scoreToBand,
  validateRelevanceWeights,
  type RelevanceScoringInput,
} from "../lib/relevance";
import { resolveTechnologyNames } from "../lib/signals";

function test(name: string, fn: () => void) {
  fn();
  console.log(`ok - ${name}`);
}

const baseDates = {
  publishedAt: "2026-06-15T00:00:00.000Z",
  ingestedAt: "2026-07-01T00:00:00.000Z",
};

const fixtures = {
  archaeologyDataset: {
    title: "New underwater archaeology photogrammetry dataset and GitHub tools",
    summary:
      "A shipwreck documentation project releases a benchmark dataset, 3D model, source code, and reproducible photogrammetry workflow for submerged cultural heritage.",
    signalType: "DATASET",
    sourceName: "OpenHeritage3D",
    canonicalUrl: "https://openheritage3d.org/datasets/shipwreck",
    githubRepositoryUrl: "https://github.com/example/shipwreck-photogrammetry",
    datasetUrl: "https://zenodo.org/records/123",
    domains: ["Marine Archaeology", "Digital Heritage"],
    technologies: ["Photogrammetry", "Computer Vision"],
    organizations: ["OpenHeritage3D"],
    researchers: ["Ada Researcher"],
    archaeologicalSites: ["Antikythera Shipwreck"],
    engagement: { githubStars: 180, citations: 12, sourceCount: 2 },
    ...baseDates,
  },
  marineRoboticsSlamPaper: {
    title: "SLAM for autonomous underwater vehicle mapping with public code",
    summary:
      "A marine robotics paper documents AUV navigation, multibeam sonar mapping, and an open-source repository for reproducible experiments.",
    signalType: "PAPER",
    sourceName: "arXiv",
    canonicalUrl: "https://arxiv.org/abs/2606.00001",
    doi: "10.1234/example",
    githubRepositoryUrl: "https://github.com/example/auv-slam",
    domains: ["underwater robotics", "ocean mapping"],
    technologies: ["AUV", "SLAM", "Multibeam Sonar"],
    researchers: ["Morgan Scientist"],
    organizations: ["Woods Hole Oceanographic Institution"],
    engagement: { githubStars: 90 },
    ...baseDates,
  },
  xrShipwreckProject: {
    title: "XR shipwreck documentation project for digital heritage access",
    summary:
      "A virtual reality and spatial computing prototype visualizes underwater cultural heritage, 3D reconstruction data, and visitor interaction design.",
    signalType: "LAB_UPDATE",
    sourceName: "UNESCO Underwater Cultural Heritage",
    domains: ["digital heritage", "marine archaeology"],
    technologies: ["VR", "Spatial Computing", "Digital Twin"],
    organizations: ["UNESCO"],
    projects: ["OpenHeritage3D"],
    ...baseDates,
  },
  graduateOpportunity: {
    title: "PhD position in marine XR and underwater cultural heritage visualization",
    summary:
      "A funded doctoral opportunity at a university lab focuses on HCI, digital heritage, shipwreck documentation, and ocean mapping dashboards.",
    signalType: "PHD_POSITION",
    sourceName: "Research Lab",
    domains: ["marine archaeology", "digital heritage"],
    technologies: ["VR", "Computer Vision"],
    organizations: ["Texas A&M University"],
    researchers: ["Dr. Rivera"],
    ...baseDates,
  },
  consumerVr: {
    title: "Consumer VR headset product announcement",
    summary:
      "A company announces a new entertainment headset for gaming and fitness applications.",
    signalType: "NEWS",
    sourceName: "Consumer Tech Daily",
    domains: ["consumer electronics"],
    technologies: ["VR"],
    ...baseDates,
  },
  genericAiBusiness: {
    title: "AI business platform launches enterprise analytics assistant",
    summary:
      "The product helps sales and finance teams prepare reports and automate meetings.",
    signalType: "NEWS",
    sourceName: "Business Wire",
    domains: ["business"],
    ...baseDates,
  },
  sports: {
    title: "Local team wins championship after overtime goal",
    summary: "Fans celebrated downtown after a dramatic sports final.",
    signalType: "NEWS",
    canonicalUrl: "https://example.com/sports",
    ...baseDates,
  },
  sparse: {
    title: "Shipwreck sonar note",
    canonicalUrl: "https://example.com/note",
  },
} satisfies Record<string, RelevanceScoringInput>;

test("default weights total 1", () => {
  const total = Object.values(DEFAULT_RELEVANCE_WEIGHTS).reduce((sum, value) => sum + value, 0);
  assert.equal(total, 1);
});

test("valid custom weights work", () => {
  const weights = validateRelevanceWeights({
    researchRelevance: 0.25,
    novelty: 0.2,
    technologyImpact: 0.2,
    portfolioUsefulness: 0.15,
    graduateValue: 0.1,
    communityAttention: 0.1,
  });

  assert.equal(weights.communityAttention, 0.1);
});

test("invalid weights fail", () => {
  assert.throws(() =>
    validateRelevanceWeights({
      researchRelevance: 0.3,
      novelty: 0.2,
      technologyImpact: 0.2,
      portfolioUsefulness: 0.15,
      graduateValue: 0.1,
    })
  );
  assert.throws(() =>
    validateRelevanceWeights({
      researchRelevance: -0.3,
      novelty: 0.2,
      technologyImpact: 0.2,
      portfolioUsefulness: 0.15,
      graduateValue: 0.1,
      communityAttention: 0.65,
    })
  );
  assert.throws(() =>
    validateRelevanceWeights({
      researchRelevance: 0.3,
      novelty: 0.2,
      technologyImpact: 0.2,
      portfolioUsefulness: 0.15,
      graduateValue: 0.1,
      communityAttention: 0.1,
    })
  );
  assert.throws(() =>
    validateRelevanceWeights({
      researchRelevance: Number.NaN,
      novelty: 0.2,
      technologyImpact: 0.2,
      portfolioUsefulness: 0.15,
      graduateValue: 0.1,
      communityAttention: 0.05,
    })
  );
  assert.throws(() =>
    validateRelevanceWeights({
      researchRelevance: Number.POSITIVE_INFINITY,
      novelty: 0.2,
      technologyImpact: 0.2,
      portfolioUsefulness: 0.15,
      graduateValue: 0.1,
      communityAttention: 0.05,
    })
  );
});

test("score bands have explicit boundaries", () => {
  assert.equal(scoreToBand(0), "IGNORE");
  assert.equal(scoreToBand(24), "IGNORE");
  assert.equal(scoreToBand(25), "LOW");
  assert.equal(scoreToBand(49), "LOW");
  assert.equal(scoreToBand(50), "MEDIUM");
  assert.equal(scoreToBand(74), "MEDIUM");
  assert.equal(scoreToBand(75), "HIGH");
  assert.equal(scoreToBand(100), "HIGH");
  assert.equal(scoreToBand(-20), "IGNORE");
  assert.equal(scoreToBand(120), "HIGH");
});

test("identical input produces deeply equal output", () => {
  const first = calculateDeterministicRelevance(fixtures.archaeologyDataset);
  const second = calculateDeterministicRelevance(fixtures.archaeologyDataset);

  assert.deepEqual(first, second);
});

test("reordered arrays, duplicates, case, and whitespace do not change scoring", () => {
  const first = calculateDeterministicRelevance({
    title: "Underwater archaeology photogrammetry dataset",
    summary: "Shipwreck 3D reconstruction with public dataset and repository.",
    signalType: "DATASET",
    domains: [" Marine Archaeology ", "Digital Heritage"],
    technologies: ["Photogrammetry", "Computer Vision"],
    datasetUrl: "https://zenodo.org/records/1",
    githubRepositoryUrl: "https://github.com/example/repo",
    ...baseDates,
  });
  const second = calculateDeterministicRelevance({
    title: " underwater   archaeology photogrammetry dataset ",
    summary: "Shipwreck 3D reconstruction with public dataset and repository.",
    signalType: "DATASET",
    domains: ["digital heritage", "marine archaeology", "marine archaeology"],
    technologies: ["computer vision", "photogrammetry", "PHOTOGRAMMETRY"],
    datasetUrl: "https://zenodo.org/records/1",
    githubRepositoryUrl: "https://github.com/example/repo",
    ...baseDates,
  });

  assert.equal(first.finalScore, second.finalScore);
  assert.deepEqual(first.dimensions, second.dimensions);
});

test("canonical technology aliases resolve through shared entity helpers", () => {
  assert.deepEqual(resolveTechnologyNames(["neural radiance fields", "3d gaussian splatting"]), [
    "Gaussian Splatting",
    "NeRF",
  ]);

  const features = extractRelevanceFeatures({
    title: "Dataset release",
    technologies: ["neural radiance fields", "remotely operated vehicle"],
  });

  assert.deepEqual(features.structuredPriorityTechnologies, ["NeRF", "ROV"]);
});

test("structured domain evidence is preferred without duplicating loose text evidence", () => {
  const structuredOnly = calculateDeterministicRelevance({
    title: "General dataset release",
    summary: "A brief update with no explicit target-domain phrase.",
    domains: ["maritime archaeology"],
    technologies: ["Photogrammetry"],
  });
  const duplicateStructuredAndText = calculateDeterministicRelevance({
    title: "Marine archaeology dataset release",
    summary: "A marine archaeology update repeats marine archaeology several times.",
    domains: ["maritime archaeology", "Marine Archaeology"],
    technologies: ["Photogrammetry"],
  });

  assert.ok(
    structuredOnly.dimensions.researchRelevance.ruleResults.some(
      (rule) => rule.ruleId === "research.domain.marine-archaeology"
    )
  );
  assert.equal(
    duplicateStructuredAndText.dimensions.researchRelevance.ruleResults.filter(
      (rule) => rule.ruleId === "research.domain.marine-archaeology"
    ).length,
    1
  );
});

test("structured technology evidence is canonicalized before loose text fallback", () => {
  const features = extractRelevanceFeatures({
    title: "General project update",
    technologies: ["autonomous underwater vehicle", "simultaneous localization and mapping"],
  });

  assert.deepEqual(features.structuredPriorityTechnologies, ["AUV", "SLAM"]);
  assert.deepEqual(features.textMatchedPriorityTechnologies, []);
  assert.deepEqual(features.matchedPriorityTechnologies, ["AUV", "SLAM"]);
});

test("duplicated technology aliases do not increase scores", () => {
  const once = calculateDeterministicRelevance({
    title: "AUV SLAM mapping",
    domains: ["underwater robotics"],
    technologies: ["autonomous underwater vehicle", "simultaneous localization and mapping"],
  });
  const duplicated = calculateDeterministicRelevance({
    title: "AUV AUV AUV SLAM SLAM mapping",
    domains: ["underwater robotics"],
    technologies: [
      "AUV",
      "autonomous underwater vehicle",
      "autonomous underwater vehicles",
      "SLAM",
      "simultaneous localization and mapping",
    ],
  });

  assert.equal(once.dimensions.technologyImpact.score, duplicated.dimensions.technologyImpact.score);
});

test("future and missing dates receive no recency benefit", () => {
  const future = calculateDeterministicRelevance({
    title: "Novel dataset release",
    summary: "A new benchmark dataset.",
    signalType: "DATASET",
    publishedAt: "2026-08-01T00:00:00.000Z",
    ingestedAt: "2026-07-01T00:00:00.000Z",
  });
  const missing = calculateDeterministicRelevance({
    title: "Novel dataset release",
    summary: "A new benchmark dataset.",
    signalType: "DATASET",
  });

  assert.equal(
    future.dimensions.novelty.ruleResults.some((rule) => rule.ruleId.startsWith("novelty.recency")),
    false
  );
  assert.equal(
    missing.dimensions.novelty.ruleResults.some((rule) => rule.ruleId.startsWith("novelty.recency")),
    false
  );
});

test("final score math uses normalized dimension scores and default weights", () => {
  const result = calculateDeterministicRelevance(fixtures.archaeologyDataset);
  const expected = Math.round(
    result.dimensions.researchRelevance.score * DEFAULT_RELEVANCE_WEIGHTS.researchRelevance +
      result.dimensions.novelty.score * DEFAULT_RELEVANCE_WEIGHTS.novelty +
      result.dimensions.technologyImpact.score * DEFAULT_RELEVANCE_WEIGHTS.technologyImpact +
      result.dimensions.portfolioUsefulness.score *
        DEFAULT_RELEVANCE_WEIGHTS.portfolioUsefulness +
      result.dimensions.graduateValue.score * DEFAULT_RELEVANCE_WEIGHTS.graduateValue +
      result.dimensions.communityAttention.score * DEFAULT_RELEVANCE_WEIGHTS.communityAttention
  );

  assert.equal(result.finalScore, expected);
  assert.equal(result.band, scoreToBand(expected));
});

test("fixture relevance behavior matches expected bands and ordering", () => {
  const archaeology = calculateDeterministicRelevance(fixtures.archaeologyDataset);
  const robotics = calculateDeterministicRelevance(fixtures.marineRoboticsSlamPaper);
  const xr = calculateDeterministicRelevance(fixtures.xrShipwreckProject);
  const opportunity = calculateDeterministicRelevance(fixtures.graduateOpportunity);
  const consumerVr = calculateDeterministicRelevance(fixtures.consumerVr);
  const aiBusiness = calculateDeterministicRelevance(fixtures.genericAiBusiness);
  const sports = calculateDeterministicRelevance(fixtures.sports);
  const sparse = calculateDeterministicRelevance(fixtures.sparse);

  assert.ok(["HIGH", "MEDIUM"].includes(archaeology.band));
  assert.ok(archaeology.finalScore >= 60);
  assert.ok(["HIGH", "MEDIUM"].includes(robotics.band));
  assert.ok(["HIGH", "MEDIUM"].includes(xr.band));
  assert.ok(["HIGH", "MEDIUM"].includes(opportunity.band));
  assert.ok(["IGNORE", "LOW"].includes(consumerVr.band));
  assert.equal(aiBusiness.band, "IGNORE");
  assert.equal(sports.band, "IGNORE");
  assert.ok(["IGNORE", "LOW"].includes(sparse.band));
  assert.ok(archaeology.finalScore > consumerVr.finalScore);
  assert.ok(consumerVr.finalScore > aiBusiness.finalScore);
});

test("missing engagement data does not produce community attention points", () => {
  const result = calculateDeterministicRelevance(fixtures.xrShipwreckProject);

  assert.equal(
    result.dimensions.communityAttention.ruleResults.some((item) =>
      item.ruleId.startsWith("community.metric")
    ),
    false
  );
});

test("public code and datasets improve portfolio usefulness", () => {
  const withArtifacts = calculateDeterministicRelevance(fixtures.archaeologyDataset);
  const withoutArtifacts = calculateDeterministicRelevance({
    ...fixtures.archaeologyDataset,
    datasetUrl: null,
    githubRepositoryUrl: null,
    signalType: "NEWS",
    title: "Underwater archaeology photogrammetry update",
    summary: "A shipwreck documentation project describes a photogrammetry workflow.",
  });

  assert.ok(
    withArtifacts.dimensions.portfolioUsefulness.score >
      withoutArtifacts.dimensions.portfolioUsefulness.score
  );
});

test("opportunities improve graduate value without forcing high technology impact", () => {
  const opportunity = calculateDeterministicRelevance({
    title: "PhD scholarship in underwater cultural heritage policy",
    summary: "A graduate opportunity for marine archaeology and conservation research.",
    signalType: "PHD_POSITION",
    domains: ["marine archaeology"],
    organizations: ["Flinders University"],
  });

  assert.ok(opportunity.dimensions.graduateValue.score > opportunity.dimensions.technologyImpact.score);
});

test("dimension and final scores remain capped with repeated phrases", () => {
  const repeated = calculateDeterministicRelevance({
    title: "Photogrammetry photogrammetry photogrammetry shipwreck shipwreck",
    summary:
      "Marine archaeology marine archaeology dataset dataset repository repository " +
      "AUV AUV SLAM SLAM sonar sonar digital twin digital twin VR VR.",
    signalType: "DATASET",
    domains: ["marine archaeology", "marine archaeology"],
    technologies: ["Photogrammetry", "Photogrammetry", "AUV", "AUV", "SLAM"],
    datasetUrl: "https://zenodo.org/records/1",
    githubRepositoryUrl: "https://github.com/example/repo",
    ...baseDates,
  });

  assert.ok(repeated.finalScore >= 0 && repeated.finalScore <= 100);
  for (const dimension of Object.values(repeated.dimensions)) {
    assert.ok(dimension.score >= 0 && dimension.score <= 100);
  }
});

test("explanations expose stable rule IDs, evidence, sorting, and no duplicates", () => {
  const result = calculateDeterministicRelevance(fixtures.archaeologyDataset);
  const keys = new Set<string>();

  for (let index = 0; index < result.explanations.length; index += 1) {
    const explanation = result.explanations[index];
    assert.match(explanation.ruleId, /^[a-z]+[a-z.-]+$/);
    assert.ok(explanation.evidence.length > 0);
    assert.equal(keys.has(`${explanation.dimension}:${explanation.ruleId}`), false);
    keys.add(`${explanation.dimension}:${explanation.ruleId}`);

    const next = result.explanations[index + 1];
    if (next) assert.ok(explanation.contribution >= next.contribution);
  }
});
