// Deterministic entity extraction uses intentionally curated dictionaries and aliases.
// It provides reliable baseline entities; optional AI-assisted extraction can layer on later.
export type {
  EntityConfidence,
  EntityDictionaryEntry,
  EntityExtractionResult,
  EntitySourceField,
  ExtractedEntity,
  ExtractedEntityType,
} from "./types";
export {
  findDictionaryEntities,
  normalizeEntityText,
  prepareSignalText,
  type SearchableTextChunk,
} from "./text";
export {
  CANONICAL_TECHNOLOGIES,
  TECHNOLOGY_DICTIONARY,
  extractTechnologyEntities,
  resolveTechnologyNames,
  type Technology,
} from "./technology-extractor";
export { extractOrganizationEntities } from "./organization-extractor";
export { extractVesselEntities } from "./vessel-extractor";
export { extractProjectEntities } from "./project-extractor";
export { extractSiteEntities } from "./site-extractor";
export { extractResearcherEntities } from "./researcher-extractor";
export {
  applyExtractedEntitiesToSignal,
  extractSignalEntities,
} from "./entity-extractor";
