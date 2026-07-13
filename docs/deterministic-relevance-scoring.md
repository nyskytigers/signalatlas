# Deterministic Relevance Scoring

SignalAtlas deterministic relevance scoring provides a pure, explainable baseline assessment for Signals. It does not call OpenAI, NVIDIA, embeddings, rerankers, or any network service.

## Architecture

The package lives in `lib/relevance` and is exposed through `lib/relevance/index.ts`.

- `types.ts` defines public input, dimensions, rule results, assessments, weights, bands, and explanations.
- `features.ts` converts Signal-like input into normalized deterministic features.
- `rules/*` contains one rule group per scoring dimension.
- `weights.ts` owns the default immutable weights and validation for custom weights.
- `bands.ts` maps final scores to bands.
- `calculator.ts` evaluates features, dimensions, weights, final score, band, and explanations.

The calculator accepts a minimal `RelevanceScoringInput`, not Prisma models. This keeps scoring safe before or after persistence.

## Shared Taxonomy And Entity Helpers

Scoring reuses the existing deterministic Signal entity layer in `lib/signals/entities`.

- Technology aliases and canonical technology names come from `TECHNOLOGY_DICTIONARY`, `CANONICAL_TECHNOLOGIES`, `extractTechnologyEntities`, and `resolveTechnologyNames`.
- General entity extraction comes from `extractSignalEntities`, which also supplies organizations, labs, institutions, researchers, projects, vessels, expeditions, and archaeological sites.
- Text normalization and whole-phrase matching use the existing `normalizeEntityText` and dictionary extraction behavior.

Structured metadata is preferred over loose text. For example, `technologies: ["neural radiance fields"]` is canonicalized to `NeRF` through the shared helper before title or summary fallback is considered. Reordered or duplicated structured values do not add repeated evidence.

Text fallback occurs only when structured fields are missing or incomplete. This lets title, summary, keyword, and safe raw metadata matches provide deterministic evidence without outranking explicit Signal metadata.

## Dimensions

Every dimension has a public integer score from 0 to 100.

1. `researchRelevance` measures alignment with SignalAtlas target domains.
2. `novelty` uses observable recency, artifact release, discovery, and novelty-language evidence.
3. `technologyImpact` measures priority technologies, enabling workflows, reusable artifacts, and technical combinations.
4. `portfolioUsefulness` measures whether a solo student project could reasonably build from the signal.
5. `graduateValue` measures researchers, labs, projects, opportunities, and research-direction fit.
6. `communityAttention` uses actual metrics only, such as citations, stars, views, social engagement, source count, and authoritative source metadata.

## Default Weights

The default immutable weights are:

```ts
{
  researchRelevance: 0.3,
  novelty: 0.2,
  technologyImpact: 0.2,
  portfolioUsefulness: 0.15,
  graduateValue: 0.1,
  communityAttention: 0.05,
}
```

Custom weights must include every dimension, contain finite non-negative numbers, and total 1 within a small floating-point tolerance.

## Score Bands

Final scores are rounded with `Math.round(weightedScore)` and clamped to 0-100 before banding.

- `HIGH`: 75-100
- `MEDIUM`: 50-74
- `LOW`: 25-49
- `IGNORE`: 0-24

## Feature Extraction

Feature extraction normalizes case and whitespace, de-duplicates arrays by normalized keys, and reuses the existing deterministic Signal entity extraction layer for technologies, organizations, researchers, projects, expeditions, vessels, and archaeological sites.

Domain/context features are derived from relevance-specific target-domain mappings in `features.ts`. In this checkout there is no exported `ResearchDomain` package or domain alias resolver comparable to the technology entity helper, so these mappings remain manual and intentionally scoped to scoring evidence. Missing data is not guessed. Malformed or future dates simply provide no recency evidence.

## Rule Evaluation

Each rule has a stable ID, dimension, contribution, description, evidence, and optional maximum contribution. Rules are awarded at most once, and contribution caps prevent repeated keywords from inflating a score.

Dimension raw scores are summed from activated rules and capped at 100. Because each dimension maximum is 100, the normalized public dimension score is:

```ts
Math.round((rawScore / 100) * 100)
```

The final score is the weighted sum of dimension scores, rounded with `Math.round`.

## Deterministic Guarantees

The assessment result includes no timestamp. The same input and scoring options produce the same output. Array order, duplicate tags, case differences, and whitespace differences do not change scores.

Publication recency is evaluated only when the input provides both a publication/update date and an ingestion reference date. The calculator does not use the current clock.

## Missing Data Behavior

Missing title, summary, source, engagement, entities, and metadata are handled conservatively. Ordinary missing Signal metadata does not throw. Invalid scoring configuration does throw because that is programmer misuse.

Community attention stays low when metrics are unavailable. It is not inferred from enthusiastic title language.

## Extension Points

Future milestones can:

- add or expose a centralized `ResearchDomain` taxonomy and route domain matching through it,
- persist deterministic assessments,
- add optional post-normalization integration helpers,
- add AI provider assessments that consume the same features and public assessment shape.

Future NVIDIA or OpenAI assessments should be layered beside this deterministic baseline. They should not replace the deterministic result, and they should use separate provider/version metadata.

Technology taxonomy additions become available to scoring when they are added to the shared `TECHNOLOGY_DICTIONARY` and remain part of `CANONICAL_TECHNOLOGIES`. Relevance scoring still decides how much those canonical technologies contribute.

The remaining relevance-only vocabularies are target-domain mappings, novelty language, dataset/repository artifact language, opportunity type/language, source-authority phrases, and scoring workflow terms such as mapping, reconstruction, autonomy, interaction, preservation, and access.

## Intentionally Not Implemented

This milestone does not implement AI classification, embeddings, semantic search, reranking, GPT evaluation, database schema changes, or automatic ingest-run scoring.

## Sample Assessment

Input:

```ts
calculateDeterministicRelevance({
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
  publishedAt: "2026-06-15T00:00:00.000Z",
  ingestedAt: "2026-07-01T00:00:00.000Z",
});
```

Representative output shape:

```ts
{
  version: "1.0.0",
  finalScore: 61,
  band: "MEDIUM",
  dimensions: {
    researchRelevance: { score: 70, /* ruleResults */ },
    novelty: { score: 64, /* ruleResults */ },
    technologyImpact: { score: 49, /* ruleResults */ },
    portfolioUsefulness: { score: 74, /* ruleResults */ },
    graduateValue: { score: 42, /* ruleResults */ },
    communityAttention: { score: 40, /* ruleResults */ },
  },
  explanations: [
    {
      dimension: "researchRelevance",
      ruleId: "research.domain.marine-archaeology",
      contribution: 24,
      description: "Signal matches the marine archaeology domain.",
      evidence: ["marineArchaeology"],
    },
    {
      dimension: "portfolioUsefulness",
      ruleId: "portfolio.artifact.repository",
      contribution: 22,
      description: "Public repository is available.",
      evidence: ["repository"],
    },
  ],
}
```

Exact scores may change when deterministic rules are intentionally versioned.
