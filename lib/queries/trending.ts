// lib/queries/trending.ts
import { prisma } from "@/db/prisma";

export async function getTrendingItems() {
  return prisma.item.findMany({
    orderBy: [
      { score: "desc" },
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
    take: 30,
    include: {
      lab: true,
      source: true,
    },
  });
}