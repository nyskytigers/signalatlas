// lib/ingest/adapters/webpage.cheerio.ts
import * as cheerio from "cheerio";

type FetchWebpageItemsArgs = {
  url: string;
  sourceId?: string;
  sourceName?: string;
  watchSelector?: string | null;
};

function absoluteUrl(baseUrl: string, href?: string | null) {
  if (!href) return "";
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return "";
  }
}

function cleanText(text?: string | null) {
  return text?.replace(/\s+/g, " ").trim() ?? "";
}

export async function fetchWebpageItemsCheerio({
  url,
  sourceId,
  sourceName = "Website",
  watchSelector,
}: FetchWebpageItemsArgs) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "SignalAtlasBot/0.1 (+research aggregator MVP)",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Webpage fetch failed: ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const selector = watchSelector || "article, .news-item, .post, li";

  const items = $(selector)
    .map((_, el) => {
      const root = $(el);

      const linkEl =
        root.find("a").first().length > 0 ? root.find("a").first() : root.closest("a");

      const href = linkEl.attr("href");
      const itemUrl = absoluteUrl(url, href);

      const title =
        cleanText(root.find("h1, h2, h3, h4").first().text()) ||
        cleanText(linkEl.text()) ||
        cleanText(root.text()).slice(0, 160);

      const summary =
        cleanText(root.find("p").first().text()) ||
        cleanText(root.text()).slice(0, 400);

      const dateText = cleanText(
        root.find("time").first().attr("datetime") ||
          root.find("time").first().text()
      );

      const publishedAt = dateText ? new Date(dateText) : undefined;
      const validDate =
        publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined;

      if (!itemUrl || !title) return null;

      return {
        sourceId,
        sourceType: "WEBSITE" as const,
        sourceName,
        externalId: itemUrl,
        url: itemUrl,
        title,
        summary,
        contentText: summary,
        publishedAt: validDate,
        authors: [],
        tags: [],
        raw: {
          selector,
          dateText,
        },
      };
    })
    .get()
    .filter(Boolean);

  const deduped = Array.from(
    new Map(items.map((item) => [item!.url, item!])).values()
  );

  return deduped.slice(0, 20);
}