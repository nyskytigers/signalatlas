// app/api/debug/items/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/db/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const count = await prisma.item.count();

  const items = await prisma.item.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      url: true,
      createdAt: true,
      sourceId: true,
      externalId: true,
    },
  });

  const dbUrl = (process.env.DATABASE_URL ?? "").replace(/:(.*?)@/, ":****@");

  return NextResponse.json({
    route: "/api/debug/items",
    now: new Date().toISOString(),
    databaseUrl: dbUrl,
    count,
    items,
  });
}