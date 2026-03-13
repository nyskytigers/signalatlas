// lib/ingest/runYoutubeIngest.ts
import { prisma } from "@/db/prisma";
import { fetchYoutubeItems } from "@/lib/ingest/adapters/youtube";
import { isDuplicate } from "@/lib/ingest/dedupe";
import { tagItem } from "@/lib/tagging/tagItem";
import { scoreItem } from "@/lib/scoring/scoreItem";

export async function runYoutubeIngest() {
  const run = await prisma.ingestRun.create({
    data: {
      type: "ALL",
      status: "RUNNING",
      notes: "YouTube ingest",
    },
  });

  let fetchedCount = 0;
  let createdCount = 0;
  let dedupedCount = 0;
  let failedCount = 0;

  try {
    const sources = await prisma.source.findMany({
      where: { isActive: true, type: "YOUTUBE" },
      include: { lab: true },
    });

    for (const src of sources) {
      try {
        const items = (
          await fetchYoutubeItems(src.url, src.id, src.name ?? "YouTube")
        ).slice(0, 10);

        fetchedCount += items.length;

        for (const it of items) {
          const tags = [...new Set([...(it.tags ?? []), ...tagItem(it)])];

          const duplicate = await isDuplicate({
            sourceId: it.sourceId,
            sourceType: "YOUTUBE",
            sourceName: it.sourceName,
            externalId: it.externalId,
            url: it.url,
            title: it.title,
            summary: it.summary,
            contentText: it.contentText,
            publishedAt: it.publishedAt,
            authors: it.authors,
            tags,
            raw: it.raw,
          });

          if (duplicate) {
            dedupedCount++;
            continue;
          }

          const s = scoreItem({
            title: it.title,
            summary: it.summary,
            tags,
            publishedAt: it.publishedAt,
            sourceType: "YOUTUBE",
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
              score: s,
              novelty: 0,
              impact: 0,
              tags,
              sourceName: it.sourceName,
              authors: it.authors ?? [],
              rawJson: it.raw ?? undefined,
            },
          });

          createdCount++;
        }

        await prisma.source.update({
          where: { id: src.id },
          data: {
            lastCheckedAt: new Date(),
            lastOkAt: new Date(),
            lastError: null,
          },
        });
      } catch (err: any) {
        console.error("YouTube ingest failed", {
          sourceId: src.id,
          url: src.url,
          error: String(err instanceof Error ? err.message : err),
        });

        failedCount++;

        await prisma.ingestEvent.create({
          data: {
            runId: run.id,
            sourceId: src.id,
            level: "ERROR",
            message: "YouTube source failed",
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

    const result = {
      sourcesCount: sources.length,
      fetchedCount,
      createdCount,
      dedupedCount,
      failedCount,
    };

    await prisma.ingestRun.update({
      where: { id: run.id },
      data: {
        status: failedCount > 0 ? "PARTIAL" : "SUCCESS",
        finishedAt: new Date(),
        ...result,
      },
    });

    return result;
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