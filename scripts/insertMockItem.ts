// scripts/insertMockItem.ts
import "dotenv/config";
import { prisma } from "../db/prisma";

async function main() {
  const lab = await prisma.lab.findFirst({ where: { isActive: true } });
  if (!lab) throw new Error("No labs found. Seed labs first.");

  const source = await prisma.source.findFirst({
    where: { labId: lab.id, isActive: true },
  });
  if (!source) throw new Error("No sources found for the first lab.");

  await prisma.item.create({
    data: {
      labId: lab.id,
      sourceId: source.id,
      url: `https://example.com/signalatlas/mock-${Date.now()}`,
      title: "Mock Signal: SignalAtlas pipeline is alive",
      summary: "This is a test item to confirm DB → UI rendering works.",
      publishedAt: new Date(),
      fetchedAt: new Date(),
      status: "FETCHED",
      score: 0,
    },
  });

  console.log("Inserted 1 mock item.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });