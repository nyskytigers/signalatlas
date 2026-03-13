// scripts/rescoreItems.ts
import "dotenv/config";
import { prisma } from "../db/prisma";
import { scoreItemV0 } from "../lib/scoring/v0";

async function main() {
  const items = await prisma.item.findMany({
    include: { lab: true, source: true },
    take: 1000,
    orderBy: { createdAt: "desc" },
  });

  let updated = 0;

  for (const it of items) {
    const s = scoreItemV0({
      title: it.title,
      summary: it.summary,
      publishedAt: it.publishedAt,
      labDomain: it.lab.domain,
      sourceType: it.source?.type ?? "UNKNOWN",
    });

    await prisma.item.update({
      where: { id: it.id },
      data: {
        score: s.score,
        novelty: s.novelty,
        impact: s.impact,
      },
    });

    updated++;
  }

  console.log(`Rescored ${updated} items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });