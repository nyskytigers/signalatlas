import { RELEVANCE_DIMENSIONS, type RelevanceDimension } from "../../relevance";
import { resolveTechnologyNames } from "../../signals";
import { NvidiaInvalidResponseError, NvidiaSchemaValidationError } from "./errors";
import type {
  ProviderDimensionScores,
  ProviderDomainAssessment,
  ProviderRelevanceAssessment,
  ProviderTechnologyAssessment,
} from "./types";

const PROVIDER_KEYS = [
  "provider",
  "model",
  "providerVersion",
  "promptVersion",
  "domains",
  "technologies",
  "dimensionScores",
  "confidence",
  "explanation",
  "dimensionExplanations",
  "warnings",
] as const;
const DOMAIN_KEYS = ["domain", "confidence", "evidence"] as const;
const TECHNOLOGY_KEYS = ["technology", "confidence", "evidence"] as const;
const MAX_ASSESSMENTS = 12;
const MAX_EVIDENCE = 6;
const MAX_WARNINGS = 10;
const MAX_STRING = 1200;
const RECOGNIZED_DOMAINS = new Set([
  "marineArchaeology",
  "underwaterRobotics",
  "xrHci",
  "digitalHeritage",
  "oceanMapping",
  "conservation",
]);

type ValidationResult<T> =
  | { ok: true; value: T; warnings: readonly string[] }
  | { ok: false; issues: readonly string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unknownKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).filter((key) => !allowed.includes(key));
}

function normalizedString(value: unknown, field: string, issues: string[], maxLength = MAX_STRING) {
  if (typeof value !== "string") {
    issues.push(`${field} must be a string.`);
    return "";
  }

  const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!normalized) issues.push(`${field} must not be blank.`);
  if (normalized.length > maxLength) issues.push(`${field} is too long.`);
  return normalized.slice(0, maxLength);
}

function finiteNumber(value: unknown, field: string, issues: string[], min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push(`${field} must be a finite number.`);
    return min;
  }

  if (value < min || value > max) {
    issues.push(`${field} must be between ${min} and ${max}.`);
  }

  return value;
}

function stringArray(value: unknown, field: string, issues: string[], maxItems: number) {
  if (!Array.isArray(value)) {
    issues.push(`${field} must be an array.`);
    return [] as string[];
  }

  if (value.length > maxItems) issues.push(`${field} has too many items.`);

  const strings = new Map<string, string>();
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string") {
      issues.push(`${field}[${index}] must be a string.`);
      continue;
    }

    const normalized = item.normalize("NFKC").replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    if (normalized.length > 240) issues.push(`${field}[${index}] is too long.`);
    const key = normalized.toLowerCase();
    if (!strings.has(key)) strings.set(key, normalized.slice(0, 240));
  }

  return Array.from(strings.values())
    .sort((a, b) => a.localeCompare(b))
    .slice(0, maxItems);
}

function parseDomains(value: unknown, issues: string[], warnings: string[]) {
  if (!Array.isArray(value)) {
    issues.push("domains must be an array.");
    return [] as ProviderDomainAssessment[];
  }
  if (value.length > MAX_ASSESSMENTS) issues.push("domains has too many items.");

  const domains = new Map<string, ProviderDomainAssessment>();
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) {
      issues.push(`domains[${index}] must be an object.`);
      continue;
    }
    const extra = unknownKeys(item, DOMAIN_KEYS);
    if (extra.length) issues.push(`domains[${index}] has unknown fields: ${extra.join(", ")}.`);

    const domain = normalizedString(item.domain, `domains[${index}].domain`, issues, 120);
    const confidence = finiteNumber(item.confidence, `domains[${index}].confidence`, issues, 0, 1);
    const evidence = stringArray(item.evidence, `domains[${index}].evidence`, issues, MAX_EVIDENCE);
    if (domain && !RECOGNIZED_DOMAINS.has(domain)) {
      warnings.push(`Unrecognized domain excluded: ${domain}`);
      continue;
    }
    if (domain && !domains.has(domain.toLowerCase())) {
      domains.set(domain.toLowerCase(), { domain, confidence, evidence });
    }
  }

  return Array.from(domains.values()).sort((a, b) => a.domain.localeCompare(b.domain));
}

function parseTechnologies(value: unknown, issues: string[], warnings: string[]) {
  if (!Array.isArray(value)) {
    issues.push("technologies must be an array.");
    return [] as ProviderTechnologyAssessment[];
  }
  if (value.length > MAX_ASSESSMENTS) issues.push("technologies has too many items.");

  const technologies = new Map<string, ProviderTechnologyAssessment>();
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) {
      issues.push(`technologies[${index}] must be an object.`);
      continue;
    }
    const extra = unknownKeys(item, TECHNOLOGY_KEYS);
    if (extra.length) issues.push(`technologies[${index}] has unknown fields: ${extra.join(", ")}.`);

    const proposed = normalizedString(item.technology, `technologies[${index}].technology`, issues, 120);
    const resolved = resolveTechnologyNames([proposed])[0];
    const confidence = finiteNumber(item.confidence, `technologies[${index}].confidence`, issues, 0, 1);
    const evidence = stringArray(item.evidence, `technologies[${index}].evidence`, issues, MAX_EVIDENCE);

    if (!resolved) {
      warnings.push(`Unrecognized technology excluded: ${proposed}`);
      continue;
    }

    if (!technologies.has(resolved.toLowerCase())) {
      technologies.set(resolved.toLowerCase(), {
        technology: resolved,
        confidence,
        evidence,
      });
    }
  }

  return Array.from(technologies.values()).sort((a, b) =>
    a.technology.localeCompare(b.technology)
  );
}

function parseDimensions(value: unknown, issues: string[]) {
  if (!isRecord(value)) {
    issues.push("dimensionScores must be an object.");
    return Object.fromEntries(RELEVANCE_DIMENSIONS.map((dimension) => [dimension, 0])) as ProviderDimensionScores;
  }

  const extra = unknownKeys(value, RELEVANCE_DIMENSIONS);
  if (extra.length) issues.push(`dimensionScores has unknown fields: ${extra.join(", ")}.`);

  return RELEVANCE_DIMENSIONS.reduce(
    (scores, dimension) => ({
      ...scores,
      [dimension]: finiteNumber(value[dimension], `dimensionScores.${dimension}`, issues, 0, 100),
    }),
    {} as ProviderDimensionScores
  );
}

function parseDimensionExplanations(value: unknown, issues: string[]) {
  if (!isRecord(value)) {
    issues.push("dimensionExplanations must be an object.");
    return RELEVANCE_DIMENSIONS.reduce(
      (explanations, dimension) => ({
        ...explanations,
        [dimension]: [],
      }),
      {} as Record<RelevanceDimension, readonly string[]>
    );
  }

  const extra = unknownKeys(value, RELEVANCE_DIMENSIONS);
  if (extra.length) issues.push(`dimensionExplanations has unknown fields: ${extra.join(", ")}.`);

  return RELEVANCE_DIMENSIONS.reduce(
    (explanations, dimension) => ({
      ...explanations,
      [dimension]: stringArray(
        value[dimension],
        `dimensionExplanations.${dimension}`,
        issues,
        4
      ),
    }),
    {} as Record<RelevanceDimension, readonly string[]>
  );
}

export function validateProviderAssessment(value: unknown): ValidationResult<ProviderRelevanceAssessment> {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(value)) return { ok: false, issues: ["Provider response must be an object."] };

  const extra = unknownKeys(value, PROVIDER_KEYS);
  if (extra.length) issues.push(`response has unknown fields: ${extra.join(", ")}.`);

  const provider = normalizedString(value.provider, "provider", issues, 20);
  if (provider !== "nvidia") issues.push("provider must be nvidia.");

  const assessment: ProviderRelevanceAssessment = {
    provider: "nvidia",
    model: normalizedString(value.model, "model", issues, 160),
    providerVersion: normalizedString(value.providerVersion, "providerVersion", issues, 80),
    promptVersion: normalizedString(value.promptVersion, "promptVersion", issues, 80),
    domains: parseDomains(value.domains, issues, warnings),
    technologies: parseTechnologies(value.technologies, issues, warnings),
    dimensionScores: parseDimensions(value.dimensionScores, issues),
    confidence: finiteNumber(value.confidence, "confidence", issues, 0, 1),
    explanation: normalizedString(value.explanation, "explanation", issues, MAX_STRING),
    dimensionExplanations: parseDimensionExplanations(value.dimensionExplanations, issues),
    warnings: stringArray(value.warnings, "warnings", issues, MAX_WARNINGS),
  };

  const combinedWarnings = stringArray([...assessment.warnings, ...warnings], "warnings", issues, MAX_WARNINGS);

  return issues.length
    ? { ok: false, issues }
    : { ok: true, value: { ...assessment, warnings: combinedWarnings }, warnings: combinedWarnings };
}

export function parseProviderJson(text: string) {
  const trimmed = text.trim();
  const markdownMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const jsonText = markdownMatch ? markdownMatch[1].trim() : trimmed;

  try {
    return JSON.parse(jsonText) as unknown;
  } catch (error) {
    throw new NvidiaInvalidResponseError(
      error instanceof Error ? `Invalid JSON response: ${error.message}` : "Invalid JSON response."
    );
  }
}

export function validateProviderJsonText(text: string) {
  const parsed = parseProviderJson(text);
  const result = validateProviderAssessment(parsed);
  if (!result.ok) throw new NvidiaSchemaValidationError(result.issues);
  return { assessment: result.value, rawResponse: parsed };
}
