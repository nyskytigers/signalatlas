import type { SignalInput } from "../types";
import type {
  EntityExtractionResult,
  EntitySourceField,
  ExtractedEntity,
} from "./types";
import { prepareSignalText } from "./text";
import { extractTechnologyEntities } from "./technology-extractor";
import { extractOrganizationEntities } from "./organization-extractor";
import { extractVesselEntities } from "./vessel-extractor";
import { extractProjectEntities } from "./project-extractor";
import { extractSiteEntities } from "./site-extractor";
import { extractResearcherEntities } from "./researcher-extractor";

const CONFIDENCE_RANK = { exact: 3, high: 2, medium: 1 } as const;
const SOURCE_RANK: Record<EntitySourceField, number> = {
  title: 4,
  summary: 3,
  keywords: 2,
  raw: 1,
};

function entityKey(entity: ExtractedEntity) {
  return `${entity.type}:${entity.canonicalName.toLowerCase()}`;
}

function compareEntities(a: ExtractedEntity, b: ExtractedEntity) {
  return (
    a.type.localeCompare(b.type) ||
    a.canonicalName.localeCompare(b.canonicalName)
  );
}

function mergeEntities(entities: ExtractedEntity[]) {
  const merged = new Map<string, ExtractedEntity>();

  for (const entity of entities) {
    const key = entityKey(entity);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...entity,
        aliases: entity.aliases ? [...entity.aliases] : undefined,
      });
      continue;
    }

    const nextConfidence = CONFIDENCE_RANK[entity.confidence];
    const currentConfidence = CONFIDENCE_RANK[existing.confidence];
    const nextSource = SOURCE_RANK[entity.sourceField];
    const currentSource = SOURCE_RANK[existing.sourceField];

    if (
      nextConfidence > currentConfidence ||
      (nextConfidence === currentConfidence && nextSource > currentSource)
    ) {
      merged.set(key, {
        ...entity,
        aliases: entity.aliases ? [...entity.aliases] : existing.aliases,
      });
    }
  }

  return Array.from(merged.values()).sort(compareEntities);
}

function namesFor(entities: ExtractedEntity[], type: ExtractedEntity["type"]) {
  return entities
    .filter((entity) => entity.type === type)
    .map((entity) => entity.canonicalName)
    .sort((a, b) => a.localeCompare(b));
}

export function extractSignalEntities(signal: SignalInput): EntityExtractionResult {
  const chunks = prepareSignalText(signal);
  const entities = mergeEntities([
    ...extractTechnologyEntities(chunks),
    ...extractOrganizationEntities(chunks),
    ...extractVesselEntities(chunks),
    ...extractProjectEntities(chunks),
    ...extractSiteEntities(chunks),
    ...extractResearcherEntities(signal, chunks),
  ]);

  return {
    entities,
    technologies: namesFor(entities, "technology"),
    organizations: namesFor(entities, "organization"),
    labs: namesFor(entities, "lab"),
    institutions: namesFor(entities, "institution"),
    researchers: namesFor(entities, "researcher"),
    projects: namesFor(entities, "project"),
    vessels: namesFor(entities, "vessel"),
    expeditions: namesFor(entities, "expedition"),
    archaeologicalSites: namesFor(entities, "archaeological_site"),
  };
}

function mergeNameArrays(...arrays: string[][]) {
  const names = new Map<string, string>();

  for (const array of arrays) {
    for (const value of array) {
      const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();
      if (!normalized) continue;

      const key = normalized.toLowerCase();
      if (!names.has(key)) names.set(key, normalized);
    }
  }

  return Array.from(names.values()).sort((a, b) => a.localeCompare(b));
}

export function applyExtractedEntitiesToSignal(
  signal: SignalInput,
  result: EntityExtractionResult = extractSignalEntities(signal)
): SignalInput {
  return {
    ...signal,
    technologies: mergeNameArrays(signal.technologies, result.technologies),
    organizations: mergeNameArrays(
      signal.organizations,
      result.organizations,
      result.labs,
      result.institutions
    ),
    researchers: mergeNameArrays(signal.researchers, result.researchers),
  };
}
