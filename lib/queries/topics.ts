// lib/queries/topics.ts
import { prisma } from "@/db/prisma";

export async function getItemsByTag(tag: string) {
  const normalizedTag = tag.trim();

  if (!normalizedTag) return [];

  return prisma.item.findMany({
    where: {
      OR: [
        {
          tags: {
            has: normalizedTag,
          },
        },
        {
          title: {
            contains: normalizedTag,
            mode: "insensitive",
          },
        },
        {
          summary: {
            contains: normalizedTag,
            mode: "insensitive",
          },
        },
      ],
    },
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