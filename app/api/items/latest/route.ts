// app/api/items/latest/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/db/prisma";

export async function GET() {
  const items = await prisma.item.findMany({
    take: 30,
    orderBy: [
      { score: "desc" },
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      title: true,
      url: true,
      summary: true,
      publishedAt: true,
      score: true,
      novelty: true,
      impact: true,
      tags: true,
      sourceName: true,
      lab: {
        select: {
          id: true,
          slug: true,
          name: true,
          org: true,
          domain: true,
        },
      },
      source: {
        select: {
          id: true,
          type: true,
          name: true,
          url: true,
        },
      },
    },
  });

  return NextResponse.json({ items });
}