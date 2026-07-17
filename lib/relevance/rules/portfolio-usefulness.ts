import type { RelevanceFeatures } from "../features";
import type { RelevanceRuleResult } from "../types";
import { hasPhrase } from "../utils";
import { rule } from "./helpers";

const DIMENSION = "portfolioUsefulness";

export function portfolioUsefulnessRules(features: RelevanceFeatures): RelevanceRuleResult[] {
  const rules: RelevanceRuleResult[] = [];

  if (features.hasRepository) {
    rules.push(
      rule(
        DIMENSION,
        "portfolio.artifact.repository",
        22,
        "Public repository is available.",
        ["repository"],
        22
      )
    );
  }

  if (features.hasDataset) {
    rules.push(
      rule(
        DIMENSION,
        "portfolio.artifact.dataset",
        18,
        "Public dataset or reconstruction data is available.",
        ["dataset"],
        18
      )
    );
  }

  if (features.hasReusableCode) {
    rules.push(
      rule(
        DIMENSION,
        "portfolio.artifact.reusable-code",
        12,
        "Reusable code or reproducible method is visible.",
        ["reusable code"],
        12
      )
    );
  }

  const buildableContexts = [
    "unity",
    "unreal",
    "web visualization",
    "dashboard",
    "xr",
    "virtual reality",
    "augmented reality",
    "simulation",
    "prototype",
    "computer vision",
    "robotics",
    "mapping",
    "3d model",
  ].filter((phrase) => hasPhrase(features.normalizedText, phrase));

  if (buildableContexts.length > 0) {
    rules.push(
      rule(
        DIMENSION,
        "portfolio.scope.prototype-friendly",
        Math.min(buildableContexts.length * 5, 20),
        "Signal suggests a manageable prototype or visualization direction.",
        buildableContexts,
        20
      )
    );
  }

  if (features.matchedPriorityTechnologies.length > 0 && features.domainDiversity > 0) {
    rules.push(
      rule(
        DIMENSION,
        "portfolio.alignment.student-project",
        12,
        "Relevant technology and domain context could support a student project.",
        [...features.matchedPriorityTechnologies.slice(0, 4), ...features.matchedTargetDomains],
        12
      )
    );
  }

  return rules;
}
