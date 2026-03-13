//lib/queries/admin.ts
import { prisma } from "@/db/prisma";

export async function getRecentIngestRuns() {
  return prisma.ingestRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
    include: {
      events: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
  });
}

export async function getSourceHealth() {
  return prisma.source.findMany({
    where: { isActive: true },
    orderBy: [{ lastErrorAt: "desc" }, { updatedAt: "desc" }],
    take: 50,
    include: {
      lab: true,
    },
  });
}

export async function getAdminStats() {
  const [labs, sources, items] = await Promise.all([
    prisma.lab.count(),
    prisma.source.count(),
    prisma.item.count(),
  ]);

  return { labs, sources, items };
}