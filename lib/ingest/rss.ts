// lib/ingest/rss.ts
import FeedParser from "feedparser-promised";

export type FeedEntry = {
  title: string;
  url: string;
  publishedAt?: Date;
  summary?: string;
};

function cleanText(s?: string | null) {
  if (!s) return undefined;
  return s
    .replace(/\s+/g, " ")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, 800);
}

export async function fetchFeed(url: string): Promise<FeedEntry[]> {
  const items = await FeedParser.parse(url);

  return items
    .map((it: any) => {
      const link = it.link || it.guid;
      if (!link) return null;

      return {
        title: (it.title || "").trim(),
        url: String(link).trim(),
        publishedAt: it.pubdate ? new Date(it.pubdate) : undefined,
        summary: cleanText(it.summary || it.description),
      } as FeedEntry;
    })
    .filter(Boolean) as FeedEntry[];
}