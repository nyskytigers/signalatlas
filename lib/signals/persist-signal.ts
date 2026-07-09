import { Prisma, type Signal as PersistedSignal } from "@prisma/client";
import { prisma } from "../../db/prisma";
import type { SignalInput } from "./types";

export type SignalPersistenceClient = {
  signal: {
    upsert(args: Prisma.SignalUpsertArgs): Promise<PersistedSignal>;
  };
};

function jsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value == null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function signalData(signal: SignalInput) {
  return {
    title: signal.title,
    summary: signal.summary,
    canonicalUrl: signal.canonicalUrl,
    signalType: signal.signalType,
    sourceId: signal.sourceId,
    sourceName: signal.sourceName,
    publishedAt: signal.publishedAt,
    technologies: signal.technologies,
    organizations: signal.organizations,
    researchers: signal.researchers,
    domains: signal.domains,
    keywords: signal.keywords,
    relevanceScore: signal.relevanceScore,
    raw: jsonValue(signal.raw),
  };
}

export function persistSignal(
  signal: SignalInput,
  client: SignalPersistenceClient = prisma
) {
  const data = signalData(signal);

  return client.signal.upsert({
    where: { canonicalUrl: signal.canonicalUrl },
    create: data,
    update: data,
  });
}
