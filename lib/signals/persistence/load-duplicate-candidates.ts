import { prisma } from "../../../db/prisma";
import type { MinimalExistingSignal } from "../dedupe";
import type { SignalInput } from "../types";
import type { SignalDatabaseClient } from "./types";

const DEFAULT_CANDIDATE_LIMIT = 25;

function titlePrefix(title: string) {
  return title.trim().replace(/\s+/g, " ").slice(0, 80);
}

export async function loadDuplicateCandidates(
  signal: SignalInput,
  client: Pick<SignalDatabaseClient, "signal"> = prisma,
  limit = DEFAULT_CANDIDATE_LIMIT
): Promise<MinimalExistingSignal[]> {
  const title = titlePrefix(signal.title);
  const boundedLimit = Math.max(1, Math.min(limit, DEFAULT_CANDIDATE_LIMIT));

  return client.signal.findMany({
    where: {
      OR: [
        { canonicalUrl: signal.canonicalUrl },
        ...(title
          ? [
              { title: { equals: signal.title, mode: "insensitive" as const } },
              { title: { contains: title, mode: "insensitive" as const } },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      title: true,
      canonicalUrl: true,
      raw: true,
      signalType: true,
    },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }, { id: "asc" }],
    take: boundedLimit,
  });
}
