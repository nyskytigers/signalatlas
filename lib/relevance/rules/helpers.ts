import type { RelevanceDimension, RelevanceRuleResult } from "../types";

export function rule(
  dimension: RelevanceDimension,
  ruleId: string,
  contribution: number,
  description: string,
  evidence: readonly string[],
  maxContribution?: number
): RelevanceRuleResult {
  return {
    ruleId,
    dimension,
    contribution,
    description,
    evidence: [...evidence].sort(),
    ...(maxContribution == null ? {} : { maxContribution }),
  };
}

export function positive(value: number) {
  return Math.max(0, value);
}
