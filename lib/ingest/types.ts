// lib/ingest/types.ts
export type NormalizedItem = {
  sourceId?: string;
  sourceType: "RSS" | "ARXIV";
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