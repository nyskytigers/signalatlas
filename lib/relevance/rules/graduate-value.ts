import type { RelevanceFeatures } from "../features";
import type { RelevanceRuleResult } from "../types";
import { hasPhrase } from "../utils";
import { rule } from "./helpers";

const DIMENSION = "graduateValue";

export function graduateValueRules(features: RelevanceFeatures): RelevanceRuleResult[] {
  const rules: RelevanceRuleResult[] = [];

  if (features.hasNamedResearchers) {
    rules.push(
      rule(
        DIMENSION,
        "graduate.people.researchers",
        14,
        "Named researchers are available for follow-up.",
        features.researchers,
        14
      )
    );
  }

  if (features.hasNamedLabOrInstitution) {
    rules.push(
      rule(
        DIMENSION,
        "graduate.people.lab-institution",
        16,
        "Named lab, institution, or organization is available.",
        features.organizations,
        16
      )
    );
  }

  if (features.hasProjectOrExpedition) {
    rules.push(
      rule(
        DIMENSION,
        "graduate.context.project-expedition",
        12,
        "Named project or expedition provides research context.",
        [...features.projects, ...features.expeditions],
        12
      )
    );
  }

  if (features.opportunityRelevance) {
    rules.push(
      rule(
        DIMENSION,
        "graduate.opportunity.formal",
        28,
        "Signal is a formal graduate, funding, internship, or event opportunity.",
        [features.signalType ?? "opportunity"],
        28
      )
    );
  }

  const opportunityLanguage = [
    "call for papers",
    "conference",
    "scholarship",
    "assistantship",
    "internship",
    "grant",
    "phd",
    "doctoral",
    "graduate",
    "fellowship",
  ].filter((phrase) => hasPhrase(features.normalizedText, phrase));

  if (opportunityLanguage.length > 0) {
    rules.push(
      rule(
        DIMENSION,
        "graduate.opportunity.language",
        Math.min(opportunityLanguage.length * 6, 18),
        "Opportunity or academic-path language is present.",
        opportunityLanguage,
        18
      )
    );
  }

  if (features.domainDiversity > 0 && features.matchedPriorityTechnologies.length > 0) {
    rules.push(
      rule(
        DIMENSION,
        "graduate.alignment.research-direction",
        12,
        "Domains and technologies align with the target research direction.",
        [...features.matchedTargetDomains, ...features.matchedPriorityTechnologies.slice(0, 3)],
        12
      )
    );
  }

  return rules;
}
