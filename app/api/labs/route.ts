// app/api/labs/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/db/prisma";

export async function GET() {
  const labs = await prisma.lab.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      sources: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return NextResponse.json({ labs });
}