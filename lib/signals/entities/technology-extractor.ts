import type { EntityDictionaryEntry, ExtractedEntity } from "./types";
import {
  findDictionaryEntities,
  normalizeEntityText,
  type SearchableTextChunk,
} from "./text";

export const TECHNOLOGY_DICTIONARY = [
  { canonicalName: "ROV", aliases: ["remotely operated vehicle", "remotely-operated vehicle"] },
  { canonicalName: "AUV", aliases: ["autonomous underwater vehicle", "autonomous underwater vehicles"] },
  { canonicalName: "SLAM", aliases: ["simultaneous localization and mapping"] },
  { canonicalName: "NeRF", aliases: ["neural radiance field", "neural radiance fields"] },
  { canonicalName: "Gaussian Splatting", aliases: ["gaussian splats", "3d gaussian splatting"] },
  { canonicalName: "Photogrammetry", aliases: ["photogrammetric"] },
  { canonicalName: "Bathymetry", aliases: ["bathymetric"] },
  { canonicalName: "LiDAR", aliases: ["lidar", "laser scanning"] },
  { canonicalName: "Side-Scan Sonar", aliases: ["side scan sonar", "sidescan sonar"] },
  { canonicalName: "Multibeam Sonar", aliases: ["multibeam", "multi-beam sonar"] },
  { canonicalName: "Spatial Computing", aliases: ["spatial-computing"] },
  { canonicalName: "VR", aliases: ["virtual reality"] },
  { canonicalName: "AR", aliases: ["augmented reality"] },
  { canonicalName: "Digital Twin", aliases: ["digital twins"] },
  { canonicalName: "Computer Vision", aliases: ["machine vision"] },
] as const satisfies readonly EntityDictionaryEntry[];

export type Technology = (typeof TECHNOLOGY_DICTIONARY)[number]["canonicalName"];

export const CANONICAL_TECHNOLOGIES = TECHNOLOGY_DICTIONARY.map(
  (technology) => technology.canonicalName
).sort((a, b) => a.localeCompare(b));

export function extractTechnologyEntities(
  chunks: SearchableTextChunk[]
): ExtractedEntity[] {
  return findDictionaryEntities(chunks, [...TECHNOLOGY_DICTIONARY], "technology");
}

export function resolveTechnologyNames(values: readonly string[]): string[] {
  const chunks = values.map((value) => ({
    sourceField: "keywords" as const,
    text: value,
    normalizedText: normalizeEntityText(value),
  }));

  const canonicalNames = new Map<string, string>();

  for (const entity of extractTechnologyEntities(chunks)) {
    const key = entity.canonicalName.toLowerCase();
    if (!canonicalNames.has(key)) canonicalNames.set(key, entity.canonicalName);
  }

  return Array.from(canonicalNames.values()).sort((a, b) => a.localeCompare(b));
}
