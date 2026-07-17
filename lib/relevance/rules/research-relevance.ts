import type { RelevanceFeatures } from "../features";
import type { RelevanceRuleResult } from "../types";
import { rule } from "./helpers";

const DIMENSION = "researchRelevance";

export function researchRelevanceRules(features: RelevanceFeatures): RelevanceRuleResult[] {
  const rules: RelevanceRuleResult[] = [];
  const domains = features.matchedTargetDomains;
  const technologies = features.matchedPriorityTechnologies;
  const hasMarineOrHeritage =
    features.marineContextStrength > 0 ||
    features.archaeologyContextStrength > 0 ||
    features.digitalHeritageStrength > 0 ||
    domains.includes("marineArchaeology") ||
    domains.includes("oceanMapping") ||
    domains.includes("digitalHeritage");

  if (domains.includes("marineArchaeology")) {
    rules.push(
      rule(
        DIMENSION,
        "research.domain.marine-archaeology",
        24,
        "Signal matches the marine archaeology domain.",
        ["marineArchaeology"],
        24
      )
    );
  }

  if (domains.includes("underwaterRobotics")) {
    rules.push(
      rule(
        DIMENSION,
        "research.domain.underwater-robotics",
        18,
        "Signal matches underwater robotics or marine autonomy.",
        ["underwaterRobotics"],
        18
      )
    );
  }

  if (domains.includes("digitalHeritage")) {
    rules.push(
      rule(
        DIMENSION,
        "research.domain.digital-heritage",
        14,
        "Signal connects to digital heritage or cultural preservation.",
        ["digitalHeritage"],
        14
      )
    );
  }

  if (domains.includes("oceanMapping")) {
    rules.push(
      rule(
        DIMENSION,
        "research.domain.ocean-mapping",
        12,
        "Signal aligns with ocean mapping or seafloor documentation.",
        ["oceanMapping"],
        12
      )
    );
  }

  if (features.hasArchaeologicalSite && hasMarineOrHeritage) {
    rules.push(
      rule(
        DIMENSION,
        "research.context.archaeological-site",
        14,
        "Signal references a vessel, shipwreck, or archaeological site in target context.",
        [...features.archaeologicalSites, ...features.vessels, "archaeological site"].filter(
          Boolean
        ),
        14
      )
    );
  }

  if (features.xrHciContextStrength > 0 && hasMarineOrHeritage) {
    rules.push(
      rule(
        DIMENSION,
        "research.combination.xr-hci-marine-heritage",
        14,
        "XR or HCI is connected to marine or heritage context.",
        ["XR/HCI", ...domains],
        14
      )
    );
  }

  if (domains.includes("underwaterRobotics") && technologies.length > 0) {
    rules.push(
      rule(
        DIMENSION,
        "research.combination.underwater-robotics-method",
        12,
        "Underwater robotics signal includes concrete priority methods or sensors.",
        technologies.slice(0, 5),
        12
      )
    );
  }

  const mappingTech = technologies.filter((technology) =>
    [
      "Photogrammetry",
      "SLAM",
      "NeRF",
      "Gaussian Splatting",
      "Side-Scan Sonar",
      "Multibeam Sonar",
      "Bathymetry",
      "Computer Vision",
      "Digital Twin",
    ].includes(technology)
  );
  if (mappingTech.length > 0 && hasMarineOrHeritage) {
    rules.push(
      rule(
        DIMENSION,
        "research.combination.mapping-reconstruction-context",
        Math.min(mappingTech.length * 5, 18),
        "Mapping or reconstruction technology is applied to marine or heritage work.",
        mappingTech,
        18
      )
    );
  }

  if (features.opportunityRelevance && hasMarineOrHeritage) {
    rules.push(
      rule(
        DIMENSION,
        "research.opportunity.aligned",
        10,
        "Opportunity is aligned with a target research domain.",
        [features.signalType ?? "opportunity"],
        10
      )
    );
  }

  if (features.domainDiversity >= 2) {
    rules.push(
      rule(
        DIMENSION,
        "research.domain.diversity",
        Math.min(features.domainDiversity * 4, 10),
        "Signal spans multiple target domains.",
        domains,
        10
      )
    );
  }

  return rules;
}
