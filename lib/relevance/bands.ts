import type { RelevanceBand } from "./types";
import { clampScore } from "./utils";

export function scoreToBand(score: number): RelevanceBand {
  const normalized = Math.round(clampScore(score));

  if (normalized >= 75) return "HIGH";
  if (normalized >= 50) return "MEDIUM";
  if (normalized >= 25) return "LOW";
  return "IGNORE";
}
