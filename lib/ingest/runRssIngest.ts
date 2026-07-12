// lib/ingest/runRssIngest.ts
import { prisma } from "@/db/prisma";
import { fetchRssItems } from "./adapters/rss";
import { isDuplicate } from "./dedupe";
import { tagItem } from "@/lib/tagging/tagItem";
import { scoreItem } from "@/lib/scoring/scoreItem";
import { maybePersistSignalForIngestItem } from "./signalPersistence";

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export async function runRssIngest(
  limitSources = 5
): Promise<{
  tried: number;
  results: Array<{
    sourceId: string;
    labSlug: string;
    inserted: number;
    skipped: number;
    errors: number;
  }>;
}> {
  const run = await prisma.ingestRun.create({
    data: { type: "RSS", status: "RUNNING" },
  });

  let fetchedCount = 0;
  let createdCount = 0;
  let dedupedCount = 0;
  let failedCount = 0;

  const results: Array<{
    sourceId: string;
    labSlug: string;
    inserted: number;
    skipped: number;
    errors: number;
  }> = [];

  try {
    const sources = await prisma.source.findMany({
      where: { isActive: true, type: "RSS" },
      include: { lab: true },
      take: limitSources,
    });

    console.log("RSS sources found:", sources.length);

    for (const src of sources) {
      let inserted = 0;
      let skipped = 0;
      let errors = 0;

      try {
        console.log("RSS source:", src.id, src.lab.slug, src.url);

        const items = (
          await fetchRssItems(src.url, src.id, src.name ?? undefined)
        ).slice(0, 20);

        console.log("RSS fetched items:", items.length, "for", src.lab.slug);

        fetchedCount += items.length;

        for (const it of items) {
          console.log("RSS item candidate:", it.title, it.url);

          const tags = tagItem(it);

          const duplicate = await isDuplicate(it);
          if (duplicate) {
            console.log("RSS duplicate skipped:", it.title);
            dedupedCount++;
            skipped++;
            continue;
          }

          const s = scoreItem({
            title: it.title,
            summary: it.summary,
            tags,
            publishedAt: it.publishedAt,
            sourceType: "RSS",
            labMatchConfidence: 1,
          });

          console.log("RSS inserting:", {
            title: it.title,
            url: it.url,
            externalId: it.externalId,
            labId: src.labId,
            sourceId: src.id,
            tags,
          });

          try {
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

            await maybePersistSignalForIngestItem(
              {
                ...it,
                tags,
              },
              {
                client: prisma,
                onFailure: async (signalError) => {
                  await prisma.ingestEvent.create({
                    data: {
                      runId: run.id,
                      sourceId: src.id,
                      level: "ERROR",
                      message: "RSS Signal persistence failed",
                      detailJson: {
                        title: it.title,
                        url: it.url,
                        error: getErrorMessage(signalError),
                      },
                    },
                  });
                },
              }
            );

            createdCount++;
            inserted++;
          } catch (err: unknown) {
            console.error("RSS item create failed:", err);

            failedCount++;
            errors++;
            skipped++;

            console.error("RSS item create failed:", {
              title: it.title,
              url: it.url,
              error: getErrorMessage(err),
            });

            await prisma.ingestEvent.create({
              data: {
                runId: run.id,
                sourceId: src.id,
                level: "ERROR",
                message: "RSS item create failed",
                detailJson: {
                  title: it.title,
                  url: it.url,
                  error: getErrorMessage(err),
                },
              },
            });
          }
        }

        await prisma.source.update({
          where: { id: src.id },
          data: {
            lastCheckedAt: new Date(),
            lastOkAt: new Date(),
            lastError: null,
          },
        });
      } catch (err: unknown) {
        failedCount++;
        errors++;

        await prisma.ingestEvent.create({
          data: {
            runId: run.id,
            sourceId: src.id,
            level: "ERROR",
            message: "RSS source failed",
            detailJson: { error: getErrorMessage(err) },
          },
        });

        await prisma.source.update({
          where: { id: src.id },
          data: {
            lastCheckedAt: new Date(),
            lastErrorAt: new Date(),
            lastError: getErrorMessage(err),
          },
        });
      }

      results.push({
        sourceId: src.id,
        labSlug: src.lab.slug,
        inserted,
        skipped,
        errors,
      });
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

    return {
      tried: sources.length,
      results,
    };
  } catch (err: unknown) {
    await prisma.ingestRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        fetchedCount,
        createdCount,
        dedupedCount,
        failedCount: failedCount + 1,
        error: getErrorMessage(err),
      },
    });

    throw err;
  }
}
