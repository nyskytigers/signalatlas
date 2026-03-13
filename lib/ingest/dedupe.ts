// lib/ingest/dedupe.ts
import { prisma } from "@/db/prisma";
import { NormalizedItem } from "./types";

export async function isDuplicate(item: NormalizedItem) {
  if (item.externalId && item.sourceId) {
    const found = await prisma.item.findFirst({
      where: {
        sourceId: item.sourceId,
        externalId: item.externalId,
      },
      select: { id: true },
    });

    if (found) {
      console.log("Duplicate by sourceId + externalId:", {
        sourceId: item.sourceId,
        externalId: item.externalId,
        title: item.title,
      });
      return true;
    }
  }

  const byUrl = await prisma.item.findUnique({
    where: { url: item.url },
    select: { id: true },
  });

  if (byUrl) {
    console.log("Duplicate by url:", {
      url: item.url,
      title: item.title,
    });
  }

  return !!byUrl;
}