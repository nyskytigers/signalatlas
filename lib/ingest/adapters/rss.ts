// lib/ingest/adapters/rss.ts
import Parser from "rss-parser";
import { NormalizedItem } from "../types";

const parser = new Parser();

export async function fetchRssItems(
  url: string,
  sourceId?: string,
  sourceName?: string
): Promise<NormalizedItem[]> {
  const feed = await parser.parseURL(url);

  return (feed.items ?? [])
    .map((item) => ({
      sourceId,
      sourceType: "RSS" as const, // keep literal type
      sourceName,
      externalId: item.guid || item.id || item.link || undefined,
      url: item.link || "",
      title: item.title?.trim() || "Untitled",
      summary: item.contentSnippet || item.content || "",
      contentText: item.content || item.contentSnippet || "",
      publishedAt: item.isoDate ? new Date(item.isoDate) : undefined,
      authors: item.creator ? [item.creator] : [],
      raw: item,
    }))
    .filter((item) => !!item.url && !!item.title);
}