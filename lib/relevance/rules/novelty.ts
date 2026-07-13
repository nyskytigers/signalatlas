import type { RelevanceFeatures } from "../features";
import type { RelevanceRuleResult } from "../types";
import { rule } from "./helpers";

const DIMENSION = "novelty";

export function noveltyRules(features: RelevanceFeatures): RelevanceRuleResult[] {
  const rules: RelevanceRuleResult[] = [];

  if (features.publicationAgeDays != null) {
    if (features.publicationAgeDays <= 30) {
      rules.push(
        rule(
          DIMENSION,
          "novelty.recency.thirty-days",
          16,
          "Signal was published within the recent scoring window.",
          [`${Math.round(features.publicationAgeDays)} days old`],
          16
        )
      );
    } else if (features.publicationAgeDays <= 180) {
      rules.push(
        rule(
          DIMENSION,
          "novelty.recency.six-months",
          8,
          "Signal was published within six months of ingestion.",
          [`${Math.round(features.publicationAgeDays)} days old`],
          8
        )
      );
    }
  }

  if (features.noveltyLanguage.length > 0) {
    rules.push(
      rule(
        DIMENSION,
        "novelty.language.observable",
        Math.min(features.noveltyLanguage.length * 7, 21),
        "Observable novelty language is present.",
        features.noveltyLanguage,
        21
      )
    );
  }

  if (features.hasDataset) {
    rules.push(
      rule(
        DIMENSION,
        "novelty.artifact.dataset",
        14,
        "Signal includes or releases a dataset.",
        ["dataset"],
        14
      )
    );
  }

  if (features.hasRepository) {
    rules.push(
      rule(
        DIMENSION,
        "novelty.artifact.repository",
        10,
        "Signal includes or releases a repository.",
        ["repository"],
        10
      )
    );
  }

  if (
    features.technologyDiversity >= 2 &&
    (features.marineContextStrength > 0 || features.archaeologyContextStrength > 0)
  ) {
    rules.push(
      rule(
        DIMENSION,
        "novelty.combination.emerging-technical-context",
        Math.min(features.technologyDiversity * 5, 15),
        "Signal combines multiple relevant technologies in a target context.",
        features.matchedPriorityTechnologies,
        15
      )
    );
  }

  if (features.signalType === "DISCOVERY" || features.signalType === "EXPEDITION") {
    rules.push(
      rule(
        DIMENSION,
        "novelty.event.discovery-expedition",
        12,
        "Signal reports a discovery or expedition update.",
        [features.signalType],
        12
      )
    );
  }

  return rules;
}
