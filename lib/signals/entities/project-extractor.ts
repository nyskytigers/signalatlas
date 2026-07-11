import type { EntityDictionaryEntry, ExtractedEntity } from "./types";
import { findDictionaryEntities, type SearchableTextChunk } from "./text";

const PROJECTS: EntityDictionaryEntry[] = [
  {
    canonicalName: "Ocean Exploration Cooperative Institute",
    aliases: ["OECI"],
    type: "project",
  },
  {
    canonicalName: "OpenHeritage3D",
    aliases: ["open heritage 3d"],
    type: "project",
  },
  {
    canonicalName: "MB-System",
    aliases: ["mb system"],
    type: "project",
  },
  {
    canonicalName: "Nautilus Live",
    aliases: ["nautiluslive"],
    type: "expedition",
  },
  {
    canonicalName: "Beyond the Blue",
    aliases: ["beyond blue"],
    type: "expedition",
  },
];

export function extractProjectEntities(
  chunks: SearchableTextChunk[]
): ExtractedEntity[] {
  return findDictionaryEntities(chunks, PROJECTS, "project");
}
