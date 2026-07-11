import type { ExtractedEntity } from "./types";
import { findDictionaryEntities, type SearchableTextChunk } from "./text";

const VESSELS = [
  {
    canonicalName: "E/V Nautilus",
    aliases: ["Nautilus", "EV Nautilus", "exploration vessel Nautilus"],
  },
  {
    canonicalName: "R/V Falkor (too)",
    aliases: ["Falkor (too)", "Falkor too", "RV Falkor too", "research vessel Falkor too"],
  },
  {
    canonicalName: "NOAA Ship Okeanos Explorer",
    aliases: ["Okeanos Explorer", "R/V Okeanos Explorer", "RV Okeanos Explorer"],
  },
  {
    canonicalName: "R/V Atlantis",
    aliases: ["Atlantis", "RV Atlantis", "research vessel Atlantis"],
  },
] as const;

export function extractVesselEntities(
  chunks: SearchableTextChunk[]
): ExtractedEntity[] {
  return findDictionaryEntities(chunks, [...VESSELS], "vessel");
}
