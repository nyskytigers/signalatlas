// lib/queries/items.ts
// lib/queries/items.ts
import { Prisma, SourceType } from "@prisma/client";
import { prisma } from "@/db/prisma";

export type FeedSearchParams = {
  type?: string;
  time?: string;
  lab?: string;
};

const sourceTypes = Object.values(SourceType);

function isSourceType(value?: string): value is SourceType {
  return !!value && sourceTypes.includes(value as SourceType);
}

function getTimeWindowDate(time?: string): Date | undefined {
  if (!time || time === "all") return undefined;

  const d = new Date();

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

  const query = Prisma.validator<Prisma.ItemFindManyArgs>()({
    where: {
      ...(isSourceType(params.type)
        ? {
            source: {
              type: params.type,
            },
          }
        : {}),
      ...(params.lab && params.lab !== "all"
        ? {
            lab: {
              slug: params.lab,
            },
          }
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

  return prisma.item.findMany(query);
}