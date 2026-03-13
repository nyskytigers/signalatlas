//app/api/health/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/db/prisma";

export async function GET() {
  const [labCount, sourceCount, itemCount, latestRun] = await Promise.all([
    prisma.lab.count(),
    prisma.source.count(),
    prisma.item.count(),
    prisma.ingestRun.findFirst({
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        type: true,
        status: true,
        startedAt: true,
        finishedAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    counts: {
      labs: labCount,
      sources: sourceCount,
      items: itemCount,
    },
    latestRun,
    now: new Date().toISOString(),
  });
}