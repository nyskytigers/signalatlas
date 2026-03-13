// lib/ingest/runWebIngest.ts
import { prisma } from "@/db/prisma";
import { isDuplicate } from "@/lib/ingest/dedupe";
import { tagItem } from "@/lib/tagging/tagItem";
import { scoreItem } from "@/lib/scoring/scoreItem";
import { fetchWebpageItemsCheerio } from "@/lib/ingest/adapters/webpage.cheerio";
import { fetchWebpageItemsPlaywright } from "@/lib/ingest/adapters/webpage.playwright";

export async function runWebIngest() {
  const run = await prisma.ingestRun.create({
    data: { type: "ALL", status: "RUNNING", notes: "Website ingest" },
  });

  let fetchedCount = 0;
  let createdCount = 0;
  let dedupedCount = 0;
  let failedCount = 0;

  try {
    const sources = await prisma.source.findMany({
      where: {
        isActive: true,
        type: "WEBSITE",
        watchMode: { not: null },
      },
      include: { lab: true },
    });

    for (const src of sources) {
      try {
        const rawItems =
          src.watchMode === "playwright"
            ? await fetchWebpageItemsPlaywright({
                url: src.url,
                sourceId: src.id,
                sourceName: src.name ?? "Website",
                watchSelector: src.watchSelector,
              })
            : await fetchWebpageItemsCheerio({
                url: src.url,
                sourceId: src.id,
                sourceName: src.name ?? "Website",
                watchSelector: src.watchSelector,
              });

        const items = rawItems.filter(
          (it): it is NonNullable<typeof it> => it != null
        );

        fetchedCount += items.length;

        for (const it of items) {
          const tags = [...new Set([...(it.tags ?? []), ...tagItem(it)])];

          const duplicate = await isDuplicate(it);
          if (duplicate) {
            dedupedCount++;
            continue;
          }

          const score = scoreItem({
            title: it.title,
            summary: it.summary,
            tags,
            publishedAt: it.publishedAt,
            sourceType: "WEBSITE",
            labMatchConfidence: 1,
          });

          await prisma.item.create({
            data: {
              labId: src.labId,
              sourceId: src.id,
              url: it.url,
              externalId: it.externalId,
              title: it.title,
              summary: it.summary,
              contentText: it.contentText,
              publishedAt: it.publishedAt,
              fetchedAt: new Date(),
              status: "FETCHED",
              score,
              tags,
              sourceName: it.sourceName,
              authors: it.authors ?? [],
              rawJson: it.raw as any,
            },
          });

          createdCount++;
        }

        await prisma.source.update({
          where: { id: src.id },
          data: { lastCheckedAt: new Date(), lastOkAt: new Date(), lastError: null },
        });
      } catch (err: any) {
        failedCount++;

        await prisma.ingestEvent.create({
          data: {
            runId: run.id,
            sourceId: src.id,
            level: "ERROR",
            message: "Website source failed",
            detailJson: { error: String(err?.message ?? err) },
          },
        });

        await prisma.source.update({
          where: { id: src.id },
          data: {
            lastCheckedAt: new Date(),
            lastErrorAt: new Date(),
            lastError: String(err?.message ?? err),
          },
        });
      }
    }

    await prisma.ingestRun.update({
      where: { id: run.id },
      data: {
        status: failedCount > 0 ? "PARTIAL" : "SUCCESS",
        finishedAt: new Date(),
        sourcesCount: sources.length,
        fetchedCount,
        createdCount,
        dedupedCount,
        failedCount,
      },
    });
  } catch (err: any) {
    await prisma.ingestRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        fetchedCount,
        createdCount,
        dedupedCount,
        failedCount: failedCount + 1,
        error: String(err?.message ?? err),
      },
    });

    throw err;
  }
}