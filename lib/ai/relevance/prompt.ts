import { RELEVANCE_DIMENSIONS } from "../../relevance";
import type { NormalizedRelevanceAssessmentInput } from "./types";

export const NVIDIA_RELEVANCE_PROMPT_VERSION = "1.0.0";

export function buildNvidiaRelevancePrompt(input: NormalizedRelevanceAssessmentInput) {
  return [
    "You are classifying SignalAtlas marine intelligence Signals.",
    `Prompt version: ${NVIDIA_RELEVANCE_PROMPT_VERSION}.`,
    "Return JSON only. Do not wrap the JSON in Markdown. Follow the provided schema exactly and do not include extra fields.",
    "",
    "Dimensions, each scored from 0 to 100:",
    "- researchRelevance: alignment with marine archaeology, underwater robotics, XR/HCI for marine or heritage work, digital twins, ocean mapping, computer vision, photogrammetry, sonar, conservation, or directly relevant opportunities.",
    "- novelty: observable novelty evidence only; recency can contribute limited evidence but must not imply scientific novelty by itself.",
    "- technologyImpact: relevant technologies enabling mapping, reconstruction, documentation, autonomy, interaction, preservation, or access.",
    "- portfolioUsefulness: public code, datasets, reproducible methods, 3D assets, visualization, XR, robotics, mapping, or dashboard project potential.",
    "- graduateValue: researchers, labs, institutions, projects, conferences, scholarships, assistantships, internships, grants, PhD opportunities, and aligned research direction.",
    "- communityAttention: supplied citations, stars, forks, views, source count, or recognized venue evidence only.",
    "",
    "Important rules:",
    "- Generic AI, VR, robotics, or computer vision is not automatically highly relevant.",
    "- Marine, underwater, archaeological, heritage, mapping, conservation, XR/HCI, research, or opportunity context matters.",
    "- Do not invent researchers, labs, repositories, datasets, citations, or metrics.",
    "- Missing metrics must not be guessed.",
    "- Opportunities may score high for graduate value without scoring high for technology impact.",
    "- Distinguish structured evidence from speculation and remain conservative when evidence is missing.",
    "",
    "Schema:",
    JSON.stringify(
      {
        provider: "nvidia",
        model: "string",
        providerVersion: "string",
        promptVersion: NVIDIA_RELEVANCE_PROMPT_VERSION,
        domains: [{ domain: "canonical domain string", confidence: 0.8, evidence: ["short evidence"] }],
        technologies: [
          { technology: "canonical technology name where possible", confidence: 0.8, evidence: ["short evidence"] },
        ],
        dimensionScores: Object.fromEntries(RELEVANCE_DIMENSIONS.map((dimension) => [dimension, 0])),
        confidence: 0.8,
        explanation: "bounded summary",
        dimensionExplanations: Object.fromEntries(RELEVANCE_DIMENSIONS.map((dimension) => [dimension, ["short reason"]])),
        warnings: ["bounded warning strings"],
      },
      null,
      2
    ),
    "",
    "Normalized Signal input:",
    JSON.stringify(input, null, 2),
  ].join("\n");
}
