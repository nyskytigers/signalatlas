import type { EntityDictionaryEntry, ExtractedEntity } from "./types";
import { findDictionaryEntities, type SearchableTextChunk } from "./text";

const ARCHAEOLOGICAL_SITES: EntityDictionaryEntry[] = [
  {
    canonicalName: "Antikythera Shipwreck",
    aliases: ["Antikythera wreck"],
    type: "archaeological_site",
  },
  {
    canonicalName: "Black Sea Shipwrecks",
    aliases: ["black sea maritime archaeology project", "Black Sea MAP"],
    type: "archaeological_site",
  },
  {
    canonicalName: "Burgzand Noord",
    aliases: ["BZN"],
    type: "archaeological_site",
  },
];

export function extractSiteEntities(
  chunks: SearchableTextChunk[]
): ExtractedEntity[] {
  return findDictionaryEntities(chunks, ARCHAEOLOGICAL_SITES, "archaeological_site");
}
