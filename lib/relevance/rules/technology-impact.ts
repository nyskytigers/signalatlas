import type { RelevanceFeatures } from "../features";
import type { RelevanceRuleResult } from "../types";
import { hasPhrase } from "../utils";
import { rule } from "./helpers";

const DIMENSION = "technologyImpact";

export function technologyImpactRules(features: RelevanceFeatures): RelevanceRuleResult[] {
  const rules: RelevanceRuleResult[] = [];

  if (features.matchedPriorityTechnologies.length > 0) {
    rules.push(
      rule(
        DIMENSION,
        "technology.priority.matches",
        Math.min(features.matchedPriorityTechnologies.length * 8, 32),
        "Signal uses priority technologies.",
        features.matchedPriorityTechnologies,
        32
      )
    );
  }

  const enablingContexts = [
    "mapping",
    "reconstruction",
    "documentation",
    "autonomy",
    "interaction",
    "preservation",
    "access",
    "visualization",
    "simulation",
  ].filter((phrase) => hasPhrase(features.normalizedText, phrase));

  if (enablingContexts.length > 0 && features.matchedPriorityTechnologies.length > 0) {
    rules.push(
      rule(
        DIMENSION,
        "technology.enables.target-workflows",
        Math.min(enablingContexts.length * 5, 20),
        "Technology supports mapping, reconstruction, autonomy, interaction, preservation, or access.",
        enablingContexts,
        20
      )
    );
  }

  const reusableArtifacts = [
    ...(features.hasRepository ? ["repository"] : []),
    ...(features.hasDataset ? ["dataset"] : []),
    ...(features.hasReusableCode ? ["reusable code"] : []),
    ...(features.hasPaperIdentifier ? ["paper identifier"] : []),
  ];
  if (reusableArtifacts.length > 0) {
    rules.push(
      rule(
        DIMENSION,
        "technology.artifacts.reusable",
        Math.min(reusableArtifacts.length * 6, 18),
        "Signal includes reusable technical artifacts or identifiers.",
        reusableArtifacts,
        18
      )
    );
  }

  if (features.technologyDiversity >= 2) {
    rules.push(
      rule(
        DIMENSION,
        "technology.combination.cross-domain",
        Math.min(features.technologyDiversity * 5, 18),
        "Signal combines multiple relevant technologies.",
        features.matchedPriorityTechnologies,
        18
      )
    );
  }

  return rules;
}
