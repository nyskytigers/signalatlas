// lib/ingest/adapters/arxiv.ts
import Parser from "rss-parser";
import { NormalizedItem } from "../types";

const parser = new Parser();

type ArxivFeedItem = {
  title?: string;
  link?: string;
  links?: Array<{
    rel?: string;
    href?: string;
  }>;
  creator?: string;
  "dc:creator"?: string;
  contentSnippet?: string;
  content?: string;
  isoDate?: string;
};

function buildArxivQuery(query: string, start = 0, maxResults = 20) {
  const encoded = encodeURIComponent(query);
  return `https://export.arxiv.org/api/query?search_query=${encoded}&start=${start}&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;
}

export async function fetchArxivItems(
  query: string,
  sourceName = "arXiv"
): Promise<NormalizedItem[]> {
  const url = buildArxivQuery(query);

  const res = await fetch(url, {
    headers: {
      "User-Agent": "SignalAtlas/0.1 (research aggregator prototype)",
      Accept: "application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    },
    cache: "no-store",
  });

  if (res.status === 429) {
    throw new Error(`arXiv rate limit hit (429) for query: ${query}`);
  }

  if (!res.ok) {
    throw new Error(`arXiv fetch failed: ${res.status} ${res.statusText}`);
  }

  const xml = await res.text();
  const feed = await parser.parseString(xml);

  return (feed.items ?? [])
    .map((item) => {
      const arxivItem = item as ArxivFeedItem;

      const link =
        arxivItem.link ||
        arxivItem.links?.find((l) => l.rel === "alternate")?.href ||
        "";

      const creator = arxivItem.creator ?? arxivItem["dc:creator"];
      const authors = creator ? [creator] : [];

      return {
        sourceType: "ARXIV" as const,
        sourceName,
        externalId: item.id || item.guid || link || undefined,
        url: link,
        title: item.title?.trim() || "Untitled",
        summary: item.contentSnippet || item.content || "",
        contentText: item.content || item.contentSnippet || "",
        publishedAt: item.isoDate ? new Date(item.isoDate) : undefined,
        authors,
        raw: item,
      };
    })
    .filter((item) => !!item.url && !!item.title);
}