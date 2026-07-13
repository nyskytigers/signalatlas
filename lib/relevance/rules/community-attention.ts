import type { RelevanceFeatures } from "../features";
import type { RelevanceRuleResult } from "../types";
import { rule } from "./helpers";

const DIMENSION = "communityAttention";

function metricEvidence(label: string, value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? `${label}: ${value}`
    : null;
}

export function communityAttentionRules(features: RelevanceFeatures): RelevanceRuleResult[] {
  const rules: RelevanceRuleResult[] = [];
  const engagement = features.availableEngagementEvidence;

  if (engagement.citations != null && engagement.citations > 0) {
    const contribution = engagement.citations >= 100 ? 24 : engagement.citations >= 25 ? 16 : 8;
    rules.push(
      rule(
        DIMENSION,
        "community.metric.citations",
        contribution,
        "Citation evidence is available.",
        [`citations: ${engagement.citations}`],
        24
      )
    );
  }

  if (engagement.githubStars != null && engagement.githubStars > 0) {
    const contribution =
      engagement.githubStars >= 1000 ? 24 : engagement.githubStars >= 100 ? 16 : 8;
    const forkEvidence = metricEvidence("forks", engagement.githubForks);
    rules.push(
      rule(
        DIMENSION,
        "community.metric.github",
        contribution,
        "GitHub stars or forks show community attention.",
        [`stars: ${engagement.githubStars}`, ...(forkEvidence ? [forkEvidence] : [])],
        24
      )
    );
  }

  if (engagement.videoViews != null && engagement.videoViews > 0) {
    const contribution =
      engagement.videoViews >= 100000 ? 18 : engagement.videoViews >= 10000 ? 12 : 6;
    rules.push(
      rule(
        DIMENSION,
        "community.metric.video-views",
        contribution,
        "Video view evidence is available.",
        [`views: ${engagement.videoViews}`],
        18
      )
    );
  }

  if (engagement.socialEngagements != null && engagement.socialEngagements > 0) {
    const contribution =
      engagement.socialEngagements >= 1000 ? 12 : engagement.socialEngagements >= 100 ? 8 : 4;
    rules.push(
      rule(
        DIMENSION,
        "community.metric.social",
        contribution,
        "Social engagement evidence is available.",
        [`engagements: ${engagement.socialEngagements}`],
        12
      )
    );
  }

  if (engagement.sourceCount != null && engagement.sourceCount > 1) {
    rules.push(
      rule(
        DIMENSION,
        "community.metric.multiple-sources",
        Math.min(engagement.sourceCount * 4, 12),
        "Multiple sources cover the same signal.",
        [`sources: ${engagement.sourceCount}`],
        12
      )
    );
  }

  if (features.sourceAuthority > 0) {
    rules.push(
      rule(
        DIMENSION,
        "community.source.authoritative",
        8,
        "Authoritative source metadata is present.",
        [features.sourceName ?? features.canonicalUrl ?? "authoritative source"],
        8
      )
    );
  }

  return rules;
}
