// lib/queries/labs.ts
import { prisma } from "@/db/prisma";

export async function getAllLabs() {
  return prisma.lab.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          items: true,
          sources: true,
        },
      },
    },
  });
}

export async function getLabBySlug(slug: string) {
  return prisma.lab.findUnique({
    where: { slug },
    include: {
      sources: {
        where: { isActive: true },
        orderBy: { type: "asc" },
      },
      _count: {
        select: {
          items: true,
          sources: true,
        },
      },
    },
  });
}

export async function getItemsForLab(slug: string) {
  return prisma.item.findMany({
    where: {
      lab: { slug },
    },
    orderBy: [
      { score: "desc" },
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
    take: 50,
    include: {
      lab: true,
      source: true,
    },
  });
}