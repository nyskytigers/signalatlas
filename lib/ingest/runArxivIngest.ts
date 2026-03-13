// lib/ingest/runArxivIngest.ts
import { prisma } from "@/db/prisma";
import { fetchArxivItems } from "@/lib/ingest/adapters/arxiv";
import { mapArxivToLab } from "@/lib/ingest/labMatchers/mapArxivToLab";
import { scoreItemV0 } from "@/lib/scoring/v0";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runArxivIngest() {
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  try {
    const querySets = [
      { query: "cat:cs.RO", sourceName: "arXiv cs.RO" },
      { query: 'cat:cs.CV AND ("virtual reality" OR "augmented reality" OR xr OR "spatial computing")', sourceName: "arXiv XR/CV" },
    ];

    const allEntries = [];
    for (const q of querySets) {
      const items = await fetchArxivItems(q.query, q.sourceName);
      allEntries.push(...items);
      await sleep(1500);
    }

    for (const e of allEntries) {
      console.log("processing arxiv item:", e.title);

      if (!e.url || !e.title) {
        skipped++;
        continue;
      }

      const match = mapArxivToLab({
        title: e.title ?? "",
        summary: e.summary ?? "",
        authors: e.authors ?? [],
        sourceText: e.sourceName ?? "",
      });

      console.log("arxiv candidate:", {
      title: e.title,
      authors: e.authors,
      sourceName: e.sourceName,
      match,
      });

      if (!match) {
        skipped++;
        console.log("skip: no lab match", e.title);
        continue;
      }

      const lab = await prisma.lab.findUnique({
        where: { slug: match.slug },
      });

      console.log("matched lab lookup:", {
      wantedSlug: match.slug,
      found: !!lab,
      });

      if (!lab) {
        skipped++;
        continue;
      }

      const source = await prisma.source.upsert({
        where: {
          labId_url: {
            labId: lab.id,
            url: e.feedUrl ?? "https://rss.arxiv.org/rss/cs.RO",
          },
        },
        update: {
          type: "ARXIV",
          name: e.sourceName ?? "arXiv",
          isActive: true,
          lastCheckedAt: new Date(),
          lastOkAt: new Date(),
          lastError: null,
        },
        create: {
          labId: lab.id,
          type: "ARXIV",
          name: e.sourceName ?? "arXiv",
          url: e.feedUrl ?? "https://rss.arxiv.org/rss/cs.RO",
          isActive: true,
          lastCheckedAt: new Date(),
          lastOkAt: new Date(),
        },
      });

      const s = scoreItemV0({
        title: e.title,
        summary: e.summary,
        publishedAt: e.publishedAt,
        labDomain: lab.domain,
        sourceType: "ARXIV",
      });

      try {
        await prisma.item.create({
          data: {
            labId: lab.id,
            sourceId: source.id,
            url: e.url,
            externalId: e.externalId,
            title: e.title,
            summary: e.summary,
            publishedAt: e.publishedAt,
            fetchedAt: new Date(),
            status: "FETCHED",
            score: s.score,
            novelty: s.novelty,
            impact: s.impact,
            sourceName: e.sourceName,
            authors: e.authors ?? [],
            tags: e.tags ?? [],
            rawJson: e.rawJson ?? null,
          },
        });

        inserted++;
      } catch (err) {
        skipped++;
        errors++;
        console.error("item create failed:", e.title, err);
      }
    }

    return { inserted, skipped, errors };
  } catch (err) {
    errors++;
    return { inserted, skipped, errors, error: String(err) };
  }
}