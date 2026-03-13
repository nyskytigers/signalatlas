// lib/ingest/adapters/youtube.ts
import Parser from "rss-parser";

type YoutubeNormalizedItem = {
  sourceId?: string;
  sourceType: "YOUTUBE";
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

const parser = new Parser();

export async function fetchYoutubeItems(
  feedUrl: string,
  sourceId?: string,
  sourceName = "YouTube"
): Promise<YoutubeNormalizedItem[]> {
  const feed = await parser.parseURL(feedUrl);

  return (feed.items ?? [])
    .map((item: any) => ({
      sourceId,
      sourceType: "YOUTUBE" as const,
      sourceName,
      externalId: item.id || item.guid || item.link || undefined,
      url: item.link || "",
      title: item.title?.trim() || "Untitled video",
      summary: item.contentSnippet || item.content || "",
      contentText: item.content || item.contentSnippet || "",
      publishedAt: item.isoDate ? new Date(item.isoDate) : undefined,
      authors: item.creator ? [item.creator] : item.author ? [item.author] : [],
      tags: ["video", "youtube"],
      raw: item,
    }))
    .filter((item) => item.url && item.title);
}