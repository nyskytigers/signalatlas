// lib/ingest/runGithubIngest.ts
import { prisma } from "@/db/prisma";
import { fetchGithubItems } from "@/lib/ingest/adapters/github";
import { isDuplicate } from "@/lib/ingest/dedupe";
import { tagItem } from "@/lib/tagging/tagItem";
import { scoreItem } from "@/lib/scoring/scoreItem";

export async function runGithubIngest() {
  const run = await prisma.ingestRun.create({
    data: {
      type: "ALL", // change to "GITHUB" later if your enum supports it
      status: "RUNNING",
      notes: "GitHub ingest",
    },
  });

  let fetchedCount = 0;
  let createdCount = 0;
  let dedupedCount = 0;
  let failedCount = 0;

  try {
    const sources = await prisma.source.findMany({
      where: { type: "GITHUB", isActive: true },
      include: { lab: true },
    });

    console.log("GitHub sources found:", sources.length);

    for (const src of sources) {
      try {
        console.log("GitHub source:", src.id, src.lab.slug, src.url);

        const items = await fetchGithubItems(src.url, src.id, src.name ?? "GitHub");
        console.log("GitHub fetched items:", items.length, "for", src.lab.slug);

        fetchedCount += items.length;

        for (const it of items) {
          console.log("GitHub item candidate:", it.title, it.url);

          const tags = [...new Set([...(it.tags ?? []), ...tagItem(it)])];

          const duplicate = await isDuplicate({
            sourceId: it.sourceId,
            sourceType: "GITHUB",
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
            console.log("GitHub duplicate skipped:", it.title);
            dedupedCount++;
            continue;
          }

          const rawRepo = it.raw as any;

          const s = scoreItem({
            title: it.title,
            summary: it.summary,
            tags,
            publishedAt: it.publishedAt,
            sourceType: "GITHUB",
            labMatchConfidence: 1,
            githubStars:
              typeof rawRepo?.stargazers_count === "number"
                ? rawRepo.stargazers_count
                : undefined,
          });

          console.log("GitHub inserting:", {
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
                score: typeof s === "number" ? s : s.score,
                novelty: typeof s === "number" ? 0 : s.novelty ?? 0,
                impact: typeof s === "number" ? 0 : s.impact ?? 0,
                tags,
                sourceName: it.sourceName,
                authors: it.authors ?? [],
                rawJson: it.raw as any,
              },
            });

            createdCount++;
          } catch (err: any) {
            console.error("GitHub item create failed:", err);
            failedCount++;

            await prisma.ingestEvent.create({
              data: {
                runId: run.id,
                sourceId: src.id,
                level: "ERROR",
                message: "GitHub item create failed",
                detailJson: {
                  title: it.title,
                  url: it.url,
                  error: String(err?.message ?? err),
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
      } catch (err: any) {
        failedCount++;

        await prisma.ingestEvent.create({
          data: {
            runId: run.id,
            sourceId: src.id,
            level: "ERROR",
            message: "GitHub source failed",
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
