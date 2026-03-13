// lib/ingest/types.ts
export type SourceType =
  | "RSS"
  | "ARXIV"
  | "YOUTUBE"
  | "GITHUB"
  | "WEBSITE";

export type NormalizedItem = {
  sourceId?: string;
  sourceType: SourceType;
  sourceName?: string;

  externalId?: string;
  url: string;
  title: string;
  summary?: string;
  contentText?: string;

  publishedAt?: Date;
  authors?: string[];

  tags?: string[];
  raw?: unknown;
};