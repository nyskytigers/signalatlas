// lib/ingest/adapters/webpage.playwright.ts
import { chromium } from "playwright";

type FetchWebpageItemsArgs = {
  url: string;
  sourceId?: string;
  sourceName?: string;
  watchSelector?: string | null;
};

function cleanText(text?: string | null) {
  return text?.replace(/\s+/g, " ").trim() ?? "";
}

export async function fetchWebpageItemsPlaywright({
  url,
  sourceId,
  sourceName = "Website",
  watchSelector,
}: FetchWebpageItemsArgs) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle" });

    const selector = watchSelector || "article, .news-item, .post, li";
    await page.waitForSelector(selector, { timeout: 10000 });

    const items = await page.$$eval(selector, (nodes) =>
      nodes.slice(0, 20).map((node) => {
        const findText = (sel: string) =>
          (node.querySelector(sel)?.textContent || "").replace(/\s+/g, " ").trim();

        const a = node.querySelector("a");
        const time = node.querySelector("time");

        return {
          href: a?.getAttribute("href") || "",
          title:
            findText("h1") ||
            findText("h2") ||
            findText("h3") ||
            findText("h4") ||
            (a?.textContent || "").replace(/\s+/g, " ").trim(),
          summary: findText("p"),
          dateText:
            time?.getAttribute("datetime") ||
            (time?.textContent || "").replace(/\s+/g, " ").trim(),
        };
      })
    );

    return items
      .map((item) => {
        const fullUrl = item.href ? new URL(item.href, url).toString() : "";
        const publishedAt = item.dateText ? new Date(item.dateText) : undefined;
        const validDate =
          publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined;

        if (!fullUrl || !cleanText(item.title)) return null;

        return {
          sourceId,
          sourceType: "WEBSITE" as const,
          sourceName,
          externalId: fullUrl,
          url: fullUrl,
          title: cleanText(item.title),
          summary: cleanText(item.summary),
          contentText: cleanText(item.summary),
          publishedAt: validDate,
          authors: [],
          tags: [],
          raw: item,
        };
      })
      .filter(Boolean);
  } finally {
    await page.close();
    await browser.close();
  }
}