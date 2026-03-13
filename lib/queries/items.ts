// lib/queries/items.ts
import { prisma } from "@/db/prisma";

export type FeedSearchParams = {
  type?: string;
  time?: string;
  lab?: string;
};

function getTimeWindowDate(time?: string): Date | undefined {
  if (!time || time === "all") return undefined;

  const now = new Date();
  const d = new Date(now);

  if (time === "24h") {
    d.setHours(d.getHours() - 24);
    return d;
  }

  if (time === "7d") {
    d.setDate(d.getDate() - 7);
    return d;
  }

  if (time === "30d") {
    d.setDate(d.getDate() - 30);
    return d;
  }

  return undefined;
}

export async function getHomepageItems(params: FeedSearchParams) {
  const afterDate = getTimeWindowDate(params.time);

  return prisma.item.findMany({
    where: {
      ...(params.type && params.type !== "all"
        ? { source: { type: params.type as any } }
        : {}),
      ...(params.lab && params.lab !== "all"
        ? { lab: { slug: params.lab } }
        : {}),
      ...(afterDate
        ? {
            OR: [
              { publishedAt: { gte: afterDate } },
              { createdAt: { gte: afterDate } },
            ],
          }
        : {}),
    },
    orderBy: [
      { score: "desc" },
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
    take: 100,
    include: {
      lab: true,
      source: true,
    },
  });
}