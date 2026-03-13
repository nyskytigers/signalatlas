// app/api/admin/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/db/prisma";

export async function GET() {
  try {
    const [labs, sources, items, latestRun] = await Promise.all([
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
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      counts: {
        labs,
        sources,
        items,
      },
      latestRun,
      now: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}