import {
  CANONICAL_TECHNOLOGIES,
  extractSignalEntities,
  resolveTechnologyNames,
} from "../signals/entities";
import type { SignalInput } from "../signals";
import type { RelevanceEngagementMetrics, RelevanceScoringInput } from "./types";
import {
  daysBetween,
  hasPhrase,
  normalizeKey,
  normalizeWhitespace,
  numericEvidence,
  parseDate,
  phrasesFound,
  rawNumberField,
  rawStringField,
  uniqueNormalized,
} from "./utils";

const TARGET_DOMAIN_ALIASES = {
  marineArchaeology: [
    "marine archaeology",
    "maritime archaeology",
    "nautical archaeology",
    "underwater archaeology",
    "underwater cultural heritage",
    "submerged cultural heritage",
    "shipwreck",
    "wreck site",
  ],
  underwaterRobotics: [
    "underwater robotics",
    "marine robotics",
    "autonomous underwater vehicle",
    "remotely operated vehicle",
    "auv",
    "rov",
    "subsea robot",
    "underwater robot",
  ],
  xrHci: [
    "xr",
    "extended reality",
    "virtual reality",
    "augmented reality",
    "mixed reality",
    "spatial computing",
    "human computer interaction",
    "hci",
  ],
  digitalHeritage: [
    "digital heritage",
    "cultural heritage",
    "heritage visualization",
    "digital preservation",
    "virtual museum",
  ],
  oceanMapping: [
    "ocean mapping",
    "seafloor mapping",
    "bathymetry",
    "bathymetric",
    "sonar mapping",
    "multibeam",
    "side scan sonar",
  ],
  conservation: [
    "conservation",
    "preservation",
    "site monitoring",
    "cultural resource management",
  ],
} as const;

const RELEVANCE_PRIORITY_TECHNOLOGIES = CANONICAL_TECHNOLOGIES;

const NOVELTY_LANGUAGE = [
  "first",
  "novel",
  "new",
  "newly",
  "newly discovered",
  "newly mapped",
  "recently released",
  "release",
  "released",
  "benchmark",
  "discovery",
  "expedition update",
] as const;

const DATASET_LANGUAGE = [
  "dataset",
  "data set",
  "benchmark",
  "records",
  "point cloud",
  "3d model",
  "reconstruction data",
] as const;

const REPOSITORY_LANGUAGE = [
  "github",
  "gitlab",
  "source code",
  "open source",
  "open-source",
  "repository",
  "code release",
] as const;

const OPPORTUNITY_TYPES = new Set(["GRANT", "SCHOLARSHIP", "INTERNSHIP", "PHD_POSITION", "EVENT"]);

const PAPER_TYPES = new Set(["PAPER", "REPORT"]);

const DATASET_TYPES = new Set(["DATASET"]);

const REPOSITORY_TYPES = new Set(["REPOSITORY"]);

const AUTHORITY_SOURCE_PHRASES = [
  "arxiv",
  "ieee",
  "acm",
  "springer",
  "elsevier",
  "nature",
  "science",
  "unesco",
  "noaa",
  "whoi",
  "mbari",
  "zenodo",
  "figshare",
  "pangaea",
  "openheritage3d",
] as const;

export type RelevanceFeatures = {
  title: string;
  summary: string;
  text: string;
  normalizedText: string;
  signalType: string | null;
  sourceName: string | null;
  sourceCategory: string | null;
  canonicalUrl: string | null;
  domains: readonly string[];
  technologies: readonly string[];
  organizations: readonly string[];
  researchers: readonly string[];
  projects: readonly string[];
  vessels: readonly string[];
  expeditions: readonly string[];
  archaeologicalSites: readonly string[];
  keywords: readonly string[];
  structuredTargetDomains: readonly string[];
  textMatchedTargetDomains: readonly string[];
  matchedTargetDomains: readonly string[];
  structuredPriorityTechnologies: readonly string[];
  textMatchedPriorityTechnologies: readonly string[];
  matchedPriorityTechnologies: readonly string[];
  domainDiversity: number;
  technologyDiversity: number;
  marineContextStrength: number;
  archaeologyContextStrength: number;
  xrHciContextStrength: number;
  underwaterRoboticsStrength: number;
  digitalHeritageStrength: number;
  hasPaperIdentifier: boolean;
  hasDataset: boolean;
  hasRepository: boolean;
  hasReusableCode: boolean;
  hasNamedResearchers: boolean;
  hasNamedLabOrInstitution: boolean;
  hasProjectOrExpedition: boolean;
  hasArchaeologicalSite: boolean;
  publicationAgeDays: number | null;
  sourceAuthority: number;
  opportunityRelevance: boolean;
  noveltyLanguage: readonly string[];
  availableEngagementEvidence: RelevanceEngagementMetrics;
};

function signalTypeFor(value: RelevanceScoringInput["signalType"]) {
  if (typeof value !== "string") return null;
  const normalized = normalizeWhitespace(value).toUpperCase();
  return normalized || null;
}

function urlFor(input: RelevanceScoringInput) {
  return normalizeWhitespace(input.canonicalUrl ?? input.githubRepositoryUrl ?? input.datasetUrl ?? "");
}

function signalForEntityExtraction(input: RelevanceScoringInput): SignalInput {
  const title = normalizeWhitespace(input.title ?? "");
  const summary = normalizeWhitespace(input.summary ?? input.description ?? "");

  return {
    title,
    summary: summary || null,
    sourceId: null,
    sourceName: input.sourceName ?? null,
    canonicalUrl: urlFor(input),
    signalType: "NEWS",
    publishedAt: parseDate(input.publishedAt),
    technologies: uniqueNormalized(input.technologies),
    organizations: uniqueNormalized(input.organizations),
    researchers: uniqueNormalized(input.researchers),
    domains: uniqueNormalized(input.domains),
    keywords: uniqueNormalized(input.keywords),
    relevanceScore: null,
    raw: input.raw ?? null,
  };
}

function strengthFor(normalizedText: string, phrases: readonly string[], arrays: readonly string[][]) {
  const matches = phrasesFound(normalizedText, phrases).length;
  const arrayMatches = arrays
    .flat()
    .filter((value) =>
      phrases.some((phrase) => normalizeKey(value) === normalizeKey(phrase))
    ).length;
  return Math.min(matches + arrayMatches, 3);
}

function structuredTargetDomains(domains: readonly string[]) {
  const matches = new Set<string>();

  for (const [domain, aliases] of Object.entries(TARGET_DOMAIN_ALIASES)) {
    if (domains.some((value) => matchesDomainValue(value, domain, aliases))) {
      matches.add(domain);
    }
  }

  return Array.from(matches).sort();
}

function textMatchedTargetDomains(normalizedText: string) {
  const matches = new Set<string>();

  for (const [domain, aliases] of Object.entries(TARGET_DOMAIN_ALIASES)) {
    if (aliases.some((alias) => hasPhrase(normalizedText, alias))) {
      matches.add(domain);
    }
  }

  return Array.from(matches).sort();
}

function matchesDomainValue(value: string, domain: string, aliases: readonly string[]) {
  const normalizedValue = normalizeKey(value);
  return (
    normalizedValue === normalizeKey(domain) ||
    aliases.some((alias) => normalizedValue === normalizeKey(alias))
  );
}

function matchedTargetDomains(
  structuredMatches: readonly string[],
  textMatches: readonly string[]
) {
  return uniqueNormalized([...structuredMatches, ...textMatches]);
}

function matchedPriorityTechnologies(technologies: readonly string[]) {
  const matches = new Set<string>();

  for (const technology of RELEVANCE_PRIORITY_TECHNOLOGIES) {
    if (technologies.some((value) => normalizeKey(value) === normalizeKey(technology))) {
      matches.add(technology);
    }
  }

  return Array.from(matches).sort((a, b) => normalizeKey(a).localeCompare(normalizeKey(b)));
}

function hasIdentifier(input: RelevanceScoringInput, normalizedText: string) {
  const doi = normalizeWhitespace(input.doi ?? rawStringField(input.raw, ["doi", "DOI"]) ?? "");
  const externalId = normalizeWhitespace(input.externalId ?? rawStringField(input.raw, ["externalId", "id"]) ?? "");

  return Boolean(doi || hasPhrase(normalizedText, "doi") || /^10\.\d{4,9}\//.test(externalId));
}

function engagementFor(input: RelevanceScoringInput): RelevanceEngagementMetrics {
  return {
    citations:
      numericEvidence(input.engagement?.citations) ??
      rawNumberField(input.raw, ["citations", "citationCount"]),
    githubStars:
      numericEvidence(input.engagement?.githubStars) ??
      rawNumberField(input.raw, ["githubStars", "stargazers_count", "stars"]),
    githubForks:
      numericEvidence(input.engagement?.githubForks) ??
      rawNumberField(input.raw, ["githubForks", "forks_count", "forks"]),
    videoViews:
      numericEvidence(input.engagement?.videoViews) ??
      rawNumberField(input.raw, ["videoViews", "viewCount"]),
    socialEngagements:
      numericEvidence(input.engagement?.socialEngagements) ??
      rawNumberField(input.raw, ["socialEngagements", "likes", "reactions"]),
    sourceCount:
      numericEvidence(input.engagement?.sourceCount) ??
      rawNumberField(input.raw, ["sourceCount", "sourcesCount"]),
  };
}

function publicationAgeDays(input: RelevanceScoringInput) {
  const publishedAt = parseDate(input.publishedAt ?? input.updatedAt);
  const referenceDate = parseDate(input.ingestedAt);

  if (!publishedAt || !referenceDate) return null;

  const age = daysBetween(publishedAt, referenceDate);
  if (age < 0) return null;

  return age;
}

export function extractRelevanceFeatures(input: RelevanceScoringInput): RelevanceFeatures {
  const signal = signalForEntityExtraction(input);
  const extracted = extractSignalEntities(signal);
  const title = normalizeWhitespace(input.title ?? "");
  const summary = normalizeWhitespace(input.summary ?? input.description ?? "");
  const sourceName = normalizeWhitespace(input.sourceName ?? "") || null;
  const sourceCategory = normalizeWhitespace(input.sourceCategory ?? "") || null;
  const canonicalUrl = urlFor(input) || null;
  const domains = uniqueNormalized(input.domains);
  const keywords = uniqueNormalized(input.keywords);
  const structuredTechnologies = resolveTechnologyNames(uniqueNormalized(input.technologies));
  const fallbackTechnologies = uniqueNormalized(extracted.technologies);
  const technologies = uniqueNormalized([...structuredTechnologies, ...fallbackTechnologies]);
  const organizations = uniqueNormalized([
    ...uniqueNormalized(input.organizations),
    ...extracted.organizations,
    ...extracted.labs,
    ...extracted.institutions,
  ]);
  const researchers = uniqueNormalized([...uniqueNormalized(input.researchers), ...extracted.researchers]);
  const projects = uniqueNormalized([...uniqueNormalized(input.projects), ...extracted.projects]);
  const vessels = uniqueNormalized([...uniqueNormalized(input.vessels), ...extracted.vessels]);
  const expeditions = uniqueNormalized([...uniqueNormalized(input.expeditions), ...extracted.expeditions]);
  const archaeologicalSites = uniqueNormalized([
    ...uniqueNormalized(input.archaeologicalSites),
    ...extracted.archaeologicalSites,
  ]);
  const fallbackText = normalizeWhitespace(
    [
      title,
      summary,
      keywords.join(" "),
      organizations.join(" "),
      sourceName ?? "",
      sourceCategory ?? "",
      canonicalUrl ?? "",
    ].join(" ")
  );
  const text = normalizeWhitespace(
    [
      fallbackText,
      domains.join(" "),
      technologies.join(" "),
    ].join(" ")
  );
  const normalizedText = normalizeKey(text);
  const normalizedFallbackText = normalizeKey(fallbackText);
  const signalType = signalTypeFor(input.signalType);
  const structuredDomains = structuredTargetDomains(domains);
  const textDomains = textMatchedTargetDomains(normalizedFallbackText);
  const targetDomains = matchedTargetDomains(structuredDomains, textDomains);
  const priorityTechnologies = matchedPriorityTechnologies(technologies);
  const engagement = engagementFor(input);
  const hasDataset =
    DATASET_TYPES.has(signalType ?? "") ||
    Boolean(input.datasetUrl) ||
    phrasesFound(normalizedText, DATASET_LANGUAGE).length > 0;
  const hasRepository =
    REPOSITORY_TYPES.has(signalType ?? "") ||
    Boolean(input.githubRepositoryUrl) ||
    /github\.com|gitlab\.com/.test(normalizedText) ||
    phrasesFound(normalizedText, REPOSITORY_LANGUAGE).length > 0;

  return {
    title,
    summary,
    text,
    normalizedText,
    signalType,
    sourceName,
    sourceCategory,
    canonicalUrl,
    domains,
    technologies,
    organizations,
    researchers,
    projects,
    vessels,
    expeditions,
    archaeologicalSites,
    keywords,
    structuredTargetDomains: structuredDomains,
    textMatchedTargetDomains: textDomains,
    matchedTargetDomains: targetDomains,
    structuredPriorityTechnologies: structuredTechnologies,
    textMatchedPriorityTechnologies: fallbackTechnologies,
    matchedPriorityTechnologies: priorityTechnologies,
    domainDiversity: targetDomains.length,
    technologyDiversity: priorityTechnologies.length,
    marineContextStrength: strengthFor(normalizedText, TARGET_DOMAIN_ALIASES.oceanMapping, [domains]),
    archaeologyContextStrength: strengthFor(normalizedText, TARGET_DOMAIN_ALIASES.marineArchaeology, [domains]),
    xrHciContextStrength: strengthFor(normalizedText, TARGET_DOMAIN_ALIASES.xrHci, [domains, technologies]),
    underwaterRoboticsStrength: strengthFor(normalizedText, TARGET_DOMAIN_ALIASES.underwaterRobotics, [domains, technologies]),
    digitalHeritageStrength: strengthFor(normalizedText, TARGET_DOMAIN_ALIASES.digitalHeritage, [domains]),
    hasPaperIdentifier: PAPER_TYPES.has(signalType ?? "") || hasIdentifier(input, normalizedText),
    hasDataset,
    hasRepository,
    hasReusableCode: hasRepository || hasPhrase(normalizedText, "reproducible method"),
    hasNamedResearchers: researchers.length > 0,
    hasNamedLabOrInstitution: organizations.length > 0,
    hasProjectOrExpedition: projects.length > 0 || expeditions.length > 0,
    hasArchaeologicalSite: archaeologicalSites.length > 0 || vessels.length > 0 || hasPhrase(normalizedText, "shipwreck"),
    publicationAgeDays: publicationAgeDays(input),
    sourceAuthority: AUTHORITY_SOURCE_PHRASES.some((phrase) =>
      hasPhrase(normalizeKey(`${sourceName ?? ""} ${canonicalUrl ?? ""}`), phrase)
    )
      ? 1
      : 0,
    opportunityRelevance: OPPORTUNITY_TYPES.has(signalType ?? "") || hasPhrase(normalizedText, "phd") || hasPhrase(normalizedText, "internship") || hasPhrase(normalizedText, "scholarship"),
    noveltyLanguage: phrasesFound(normalizedText, NOVELTY_LANGUAGE),
    availableEngagementEvidence: engagement,
  };
}
