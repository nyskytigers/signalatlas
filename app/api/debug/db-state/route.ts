// app/api/debug/db-state/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/db/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const [labs, sources, items] = await Promise.all([
    prisma.lab.count(),
    prisma.source.count(),
    prisma.item.count(),
  ]);

  const dbUrl = (process.env.DATABASE_URL ?? "").replace(/:(.*?)@/, ":****@");

  return NextResponse.json({
    route: "/api/debug/db-state",
    now: new Date().toISOString(),
    databaseUrl: dbUrl,
    labs,
    sources,
    items,
  });
}