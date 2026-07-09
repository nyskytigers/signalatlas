import type { NormalizedItem, SourceType } from "../ingest/types";
import { isSignalType, type SignalInput, type SignalType } from "./types";

type SourceLike = {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  url?: unknown;
};

export type NormalizedSignalItem = Partial<
  Omit<NormalizedItem, "sourceType" | "summary">
> & {
  title: string;
  sourceType?: SourceType | string;
  summary?: string | null;
  canonicalUrl?: string | null;
  sourceUrl?: string | null;
  link?: string | null;
  description?: string | null;
  snippet?: string | null;
  contentSnippet?: string | null;
  source?: SourceLike | null;
  signalType?: string | null;
  type?: string | null;
  itemType?: string | null;
  kind?: string | null;
  technologies?: string[] | null;
  organizations?: string[] | null;
  researchers?: string[] | null;
  domains?: string[] | null;
  keywords?: string[] | null;
  relevanceScore?: number | null;
  metadata?: unknown;
};

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") continue;

    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }

  return null;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function nullableDate(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function textIncludes(haystack: string, ...needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

function inferSignalType(item: NormalizedSignalItem): SignalType {
  if (isSignalType(item.signalType)) return item.signalType;

  const sourceType = firstString(item.sourceType, item.source?.type);
  const text = [
    sourceType,
    item.type,
    item.itemType,
    item.kind,
    item.sourceName,
    item.title,
    item.url,
    item.canonicalUrl,
    item.sourceUrl,
    item.link,
    ...stringArray(item.tags),
    ...stringArray(item.keywords),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    textIncludes(
      text,
      "dataset",
      "data set",
      "data repository",
      "zenodo",
      "figshare",
      "kaggle",
      "dataverse"
    )
  ) {
    return "DATASET";
  }

  if (
    sourceType === "GITHUB" ||
    textIncludes(text, "github.com", "repository", "source code")
  ) {
    return "REPOSITORY";
  }

  if (sourceType === "ARXIV" || textIncludes(text, "arxiv", "paper", "preprint")) {
    return "PAPER";
  }

  if (
    sourceType === "YOUTUBE" ||
    textIncludes(text, "youtube.com", "youtu.be", "video")
  ) {
    return "VIDEO";
  }

  if (textIncludes(text, "scholarship", "fellowship")) return "SCHOLARSHIP";
  if (textIncludes(text, "internship")) return "INTERNSHIP";
  if (textIncludes(text, "phd", "ph.d", "doctoral position")) {
    return "PHD_POSITION";
  }
  if (textIncludes(text, "grant", "funding opportunity")) return "GRANT";
  if (textIncludes(text, "expedition", "field campaign", "cruise")) {
    return "EXPEDITION";
  }
  if (textIncludes(text, "discovery", "breakthrough")) return "DISCOVERY";
  if (textIncludes(text, "report", "white paper", "whitepaper")) return "REPORT";
  if (
    textIncludes(text, "conference", "workshop", "webinar", "symposium", "event")
  ) {
    return "EVENT";
  }

  if (textIncludes(text, "lab update", "homepage")) return "LAB_UPDATE";

  return "NEWS";
}

export function normalizedItemToSignal(item: NormalizedSignalItem): SignalInput {
  const researchers = stringArray(item.researchers);
  const keywords = stringArray(item.keywords);
  const canonicalUrl = firstString(
    item.canonicalUrl,
    item.url,
    item.sourceUrl,
    item.link,
    item.source?.url
  );

  if (!canonicalUrl) {
    throw new Error(
      "Normalized item must include canonicalUrl, url, sourceUrl, link, or source.url."
    );
  }

  return {
    title: item.title,
    summary: firstString(
      item.summary,
      item.description,
      item.snippet,
      item.contentSnippet
    ),
    sourceId: firstString(item.sourceId, item.source?.id),
    sourceName: firstString(item.sourceName, item.source?.name),
    canonicalUrl,
    signalType: inferSignalType(item),
    publishedAt: nullableDate(item.publishedAt),
    technologies: stringArray(item.technologies),
    organizations: stringArray(item.organizations),
    researchers: researchers.length ? researchers : stringArray(item.authors),
    domains: stringArray(item.domains),
    keywords: keywords.length ? keywords : stringArray(item.tags),
    relevanceScore:
      typeof item.relevanceScore === "number" ? item.relevanceScore : null,
    raw: item.raw ?? item.metadata ?? null,
  };
}
