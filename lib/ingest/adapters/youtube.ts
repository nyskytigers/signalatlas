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

type YouTubeFeedItem = {
  id?: string;
  guid?: string;
  link?: string;
  title?: string;
  contentSnippet?: string;
  content?: string;
  isoDate?: string;
  creator?: string;
  author?: string;
};

const parser = new Parser();

export async function fetchYoutubeItems(
  feedUrl: string,
  sourceId?: string,
  sourceName = "YouTube"
): Promise<YoutubeNormalizedItem[]> {
  const feed = await parser.parseURL(feedUrl);

  return (feed.items ?? [])
    .map((item: unknown) => {
      const youtubeItem = item as YouTubeFeedItem;

      return {
        sourceId,
        sourceType: "YOUTUBE" as const,
        sourceName,
        externalId: youtubeItem.id || youtubeItem.guid || youtubeItem.link || undefined,
        url: youtubeItem.link || "",
        title: youtubeItem.title?.trim() || "Untitled video",
        summary: youtubeItem.contentSnippet || youtubeItem.content || "",
        contentText: youtubeItem.content || youtubeItem.contentSnippet || "",
        publishedAt: youtubeItem.isoDate ? new Date(youtubeItem.isoDate) : undefined,
        authors: youtubeItem.creator ? [youtubeItem.creator] : youtubeItem.author ? [youtubeItem.author] : [],
        tags: ["video", "youtube"],
        raw: youtubeItem,
      };
    })
    .filter((item) => item.url && item.title);
}