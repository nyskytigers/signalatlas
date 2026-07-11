import type { ExtractedEntity } from "./types";
import { findDictionaryEntities, type SearchableTextChunk } from "./text";

const TECHNOLOGIES = [
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
] as const;

export function extractTechnologyEntities(
  chunks: SearchableTextChunk[]
): ExtractedEntity[] {
  return findDictionaryEntities(chunks, [...TECHNOLOGIES], "technology");
}
