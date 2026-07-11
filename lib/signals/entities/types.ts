export type ExtractedEntityType =
  | "technology"
  | "organization"
  | "lab"
  | "institution"
  | "researcher"
  | "project"
  | "vessel"
  | "expedition"
  | "archaeological_site";

export type EntitySourceField = "title" | "summary" | "keywords" | "raw";

export type EntityConfidence = "exact" | "high" | "medium";

export type ExtractedEntity = {
  type: ExtractedEntityType;
  canonicalName: string;
  matchedText: string;
  sourceField: EntitySourceField;
  confidence: EntityConfidence;
  aliases?: string[];
};

export type EntityExtractionResult = {
  entities: ExtractedEntity[];
  technologies: string[];
  organizations: string[];
  labs: string[];
  institutions: string[];
  researchers: string[];
  projects: string[];
  vessels: string[];
  expeditions: string[];
  archaeologicalSites: string[];
};

export type EntityDictionaryEntry = {
  canonicalName: string;
  aliases: readonly string[];
  type?: ExtractedEntityType;
  confidence?: EntityConfidence;
};
