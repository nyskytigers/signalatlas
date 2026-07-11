import type { EntityDictionaryEntry, ExtractedEntity } from "./types";
import { findDictionaryEntities, type SearchableTextChunk } from "./text";

const ORGANIZATIONS: EntityDictionaryEntry[] = [
  { canonicalName: "NOAA", aliases: ["national oceanic and atmospheric administration"] },
  { canonicalName: "NOAA Ocean Exploration", aliases: ["NOAA OE", "ocean exploration"] },
  { canonicalName: "UNESCO", aliases: ["united nations educational scientific and cultural organization"] },
  {
    canonicalName: "UNESCO Underwater Cultural Heritage",
    aliases: ["underwater cultural heritage", "UNESCO UCH"],
  },
  {
    canonicalName: "Woods Hole Oceanographic Institution",
    aliases: ["WHOI"],
    type: "institution",
  },
  {
    canonicalName: "Monterey Bay Aquarium Research Institute",
    aliases: ["MBARI"],
    type: "lab",
  },
  { canonicalName: "Ocean Exploration Trust", aliases: ["OET"] },
  { canonicalName: "Schmidt Ocean Institute", aliases: ["SOI"] },
  { canonicalName: "Texas A&M University", aliases: ["TAMU"], type: "institution" },
  { canonicalName: "Institute of Nautical Archaeology", aliases: ["INA"] },
  { canonicalName: "Flinders University", aliases: [], type: "institution" },
  { canonicalName: "Maritime Archaeology Trust", aliases: [] },
  { canonicalName: "CyArk", aliases: [] },
  { canonicalName: "OpenHeritage3D", aliases: ["open heritage 3d"] },
  { canonicalName: "Harvard Dataverse", aliases: [], type: "institution" },
  { canonicalName: "Zenodo", aliases: [] },
  { canonicalName: "Figshare", aliases: [] },
  { canonicalName: "PANGAEA", aliases: ["pangaea data publisher"] },
];

export function extractOrganizationEntities(
  chunks: SearchableTextChunk[]
): ExtractedEntity[] {
  return findDictionaryEntities(chunks, ORGANIZATIONS, "organization");
}
