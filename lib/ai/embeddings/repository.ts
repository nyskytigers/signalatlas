import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db/prisma";
import { validateEmbeddingVector } from "./validation";
import type {
  EmbeddingRepository,
  SemanticSearchFilters,
  SignalEmbeddingRecord,
} from "./types";

function vectorLiteral(vector: readonly number[]) {
  return `[${vector.join(",")}]`;
}

function toDate(value: Date | string | undefined) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function filterConditions(filters: SemanticSearchFilters | undefined) {
  const conditions: Prisma.Sql[] = [];
  if (!filters) return conditions;

  if (filters.signalType) conditions.push(Prisma.sql`s."signalType" = ${filters.signalType}`);
  if (filters.domain) conditions.push(Prisma.sql`${filters.domain} = ANY(s.domains)`);
  if (filters.technology) conditions.push(Prisma.sql`${filters.technology} = ANY(s.technologies)`);
  if (filters.sourceName) conditions.push(Prisma.sql`s."sourceName" = ${filters.sourceName}`);

  const publishedAfter = toDate(filters.publishedAfter);
  if (publishedAfter) conditions.push(Prisma.sql`s."publishedAt" >= ${publishedAfter}`);

  const publishedBefore = toDate(filters.publishedBefore);
  if (publishedBefore) conditions.push(Prisma.sql`s."publishedAt" <= ${publishedBefore}`);

  return conditions;
}

function whereSql(base: readonly Prisma.Sql[], filters?: SemanticSearchFilters) {
  const conditions = [...base, ...filterConditions(filters)];
  return conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
}

function recordFrom(row: SignalEmbeddingRecord): SignalEmbeddingRecord {
  return {
    ...row,
    errorCode: row.errorCode ?? null,
    errorMessage: row.errorMessage ?? null,
  };
}

export function createPrismaEmbeddingRepository(): EmbeddingRepository {
  return {
    async findSignal(signalId) {
      return prisma.signal.findUnique({
        where: { id: signalId },
        select: {
          id: true,
          title: true,
          summary: true,
          canonicalUrl: true,
          signalType: true,
          sourceName: true,
          publishedAt: true,
          domains: true,
          technologies: true,
          organizations: true,
          researchers: true,
          keywords: true,
        },
      });
    },

    async findSignals(args) {
      const where = args.signalIds?.length
        ? { id: { in: [...args.signalIds] } }
        : undefined;
      const signals = await prisma.signal.findMany({
        where,
        orderBy: { id: "asc" },
        take: args.limit,
        select: {
          id: true,
          title: true,
          summary: true,
          canonicalUrl: true,
          signalType: true,
          sourceName: true,
          publishedAt: true,
          domains: true,
          technologies: true,
          organizations: true,
          researchers: true,
          keywords: true,
        },
      });

      if (!args.onlyMissing) return signals;

      const existing = await prisma.signalEmbedding.findMany({
        where: {
          signalId: { in: signals.map((signal) => signal.id) },
          provider: args.version.provider,
          model: args.version.model,
          embeddingVersion: args.version.embeddingVersion,
          status: "SUCCESS",
        },
        select: { signalId: true },
      });
      const existingIds = new Set(existing.map((item) => item.signalId));
      return signals.filter((signal) => !existingIds.has(signal.id));
    },

    async findCompatibleEmbedding(args) {
      const record = await prisma.signalEmbedding.findUnique({
        where: {
          signalId_provider_model_embeddingVersion: {
            signalId: args.signalId,
            provider: args.version.provider,
            model: args.version.model,
            embeddingVersion: args.version.embeddingVersion,
          },
        },
      });
      return record ? recordFrom(record) : null;
    },

    async upsertSuccess(args) {
      const id = randomUUID();
      const embedding = validateEmbeddingVector(args.embedding, args.version.dimensions);
      const rows = await prisma.$queryRaw<SignalEmbeddingRecord[]>`
        INSERT INTO "SignalEmbedding" (
          "id", "signalId", "provider", "model", "providerVersion",
          "embeddingVersion", "inputVersion", "dimensions", "contentHash",
          "sourceTextHash", "status", "errorCode", "errorMessage",
          "metadataJson", "embedding", "createdAt", "updatedAt"
        )
        VALUES (
          ${id}, ${args.signalId}, ${args.version.provider}, ${args.version.model},
          ${args.version.providerVersion}, ${args.version.embeddingVersion},
          ${args.version.inputVersion}, ${args.version.dimensions},
          ${args.contentHash}, ${args.sourceTextHash}, ${"SUCCESS"}, NULL, NULL,
          ${args.metadata ?? null}, ${vectorLiteral(embedding)}::vector,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("signalId", "provider", "model", "embeddingVersion")
        DO UPDATE SET
          "providerVersion" = EXCLUDED."providerVersion",
          "inputVersion" = EXCLUDED."inputVersion",
          "dimensions" = EXCLUDED."dimensions",
          "contentHash" = EXCLUDED."contentHash",
          "sourceTextHash" = EXCLUDED."sourceTextHash",
          "status" = EXCLUDED."status",
          "errorCode" = NULL,
          "errorMessage" = NULL,
          "metadataJson" = EXCLUDED."metadataJson",
          "embedding" = EXCLUDED."embedding",
          "updatedAt" = CURRENT_TIMESTAMP
        RETURNING
          "id", "signalId", "provider", "model", "providerVersion",
          "embeddingVersion", "inputVersion", "dimensions", "contentHash",
          "sourceTextHash", "status", "errorCode", "errorMessage",
          "createdAt", "updatedAt"
      `;
      return recordFrom(rows[0]);
    },

    async upsertFailure(args) {
      const id = randomUUID();
      const rows = await prisma.$queryRaw<SignalEmbeddingRecord[]>`
        INSERT INTO "SignalEmbedding" (
          "id", "signalId", "provider", "model", "providerVersion",
          "embeddingVersion", "inputVersion", "dimensions", "contentHash",
          "sourceTextHash", "status", "errorCode", "errorMessage",
          "metadataJson", "embedding", "createdAt", "updatedAt"
        )
        VALUES (
          ${id}, ${args.signalId}, ${args.version.provider}, ${args.version.model},
          ${args.version.providerVersion}, ${args.version.embeddingVersion},
          ${args.version.inputVersion}, ${args.version.dimensions},
          ${args.contentHash}, ${args.sourceTextHash}, ${"FAILED"},
          ${args.errorCode}, ${args.errorMessage.slice(0, 1000)}, NULL, NULL,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("signalId", "provider", "model", "embeddingVersion")
        DO UPDATE SET
          "providerVersion" = CASE
            WHEN "SignalEmbedding"."status" = 'SUCCESS' AND "SignalEmbedding"."embedding" IS NOT NULL
              THEN "SignalEmbedding"."providerVersion"
            ELSE EXCLUDED."providerVersion"
          END,
          "inputVersion" = CASE
            WHEN "SignalEmbedding"."status" = 'SUCCESS' AND "SignalEmbedding"."embedding" IS NOT NULL
              THEN "SignalEmbedding"."inputVersion"
            ELSE EXCLUDED."inputVersion"
          END,
          "dimensions" = CASE
            WHEN "SignalEmbedding"."status" = 'SUCCESS' AND "SignalEmbedding"."embedding" IS NOT NULL
              THEN "SignalEmbedding"."dimensions"
            ELSE EXCLUDED."dimensions"
          END,
          "contentHash" = CASE
            WHEN "SignalEmbedding"."status" = 'SUCCESS' AND "SignalEmbedding"."embedding" IS NOT NULL
              THEN "SignalEmbedding"."contentHash"
            ELSE EXCLUDED."contentHash"
          END,
          "sourceTextHash" = CASE
            WHEN "SignalEmbedding"."status" = 'SUCCESS' AND "SignalEmbedding"."embedding" IS NOT NULL
              THEN "SignalEmbedding"."sourceTextHash"
            ELSE EXCLUDED."sourceTextHash"
          END,
          "status" = CASE
            WHEN "SignalEmbedding"."status" = 'SUCCESS' AND "SignalEmbedding"."embedding" IS NOT NULL
              THEN "SignalEmbedding"."status"
            ELSE EXCLUDED."status"
          END,
          "errorCode" = CASE
            WHEN "SignalEmbedding"."status" = 'SUCCESS' AND "SignalEmbedding"."embedding" IS NOT NULL
              THEN "SignalEmbedding"."errorCode"
            ELSE EXCLUDED."errorCode"
          END,
          "errorMessage" = CASE
            WHEN "SignalEmbedding"."status" = 'SUCCESS' AND "SignalEmbedding"."embedding" IS NOT NULL
              THEN "SignalEmbedding"."errorMessage"
            ELSE EXCLUDED."errorMessage"
          END,
          "metadataJson" = CASE
            WHEN "SignalEmbedding"."status" = 'SUCCESS' AND "SignalEmbedding"."embedding" IS NOT NULL
              THEN COALESCE("SignalEmbedding"."metadataJson", '{}'::jsonb) || jsonb_build_object(
                'lastFailure', jsonb_build_object(
                  'code', EXCLUDED."errorCode",
                  'message', EXCLUDED."errorMessage",
                  'contentHash', EXCLUDED."contentHash",
                  'at', CURRENT_TIMESTAMP
                )
              )
            ELSE "SignalEmbedding"."metadataJson"
          END,
          "embedding" = CASE
            WHEN "SignalEmbedding"."status" = 'SUCCESS' AND "SignalEmbedding"."embedding" IS NOT NULL
              THEN "SignalEmbedding"."embedding"
            ELSE NULL
          END,
          "updatedAt" = CURRENT_TIMESTAMP
        RETURNING
          "id", "signalId", "provider", "model", "providerVersion",
          "embeddingVersion", "inputVersion", "dimensions", "contentHash",
          "sourceTextHash", "status", "errorCode", "errorMessage",
          "createdAt", "updatedAt"
      `;
      return recordFrom(rows[0]);
    },

    async searchByVector(args) {
      const vector = validateEmbeddingVector(args.vector, args.version.dimensions);
      const base = [
        Prisma.sql`e.status = ${"SUCCESS"}`,
        Prisma.sql`e.provider = ${args.version.provider}`,
        Prisma.sql`e.model = ${args.version.model}`,
        Prisma.sql`e."embeddingVersion" = ${args.version.embeddingVersion}`,
        Prisma.sql`e.dimensions = ${args.version.dimensions}`,
        Prisma.sql`e.embedding IS NOT NULL`,
      ];
      const where = whereSql(base, args.filters);
      const rows = await prisma.$queryRaw<
        Array<{
          signalId: string;
          title: string;
          url: string;
          signalType: string;
          similarity: number;
          provider: string;
          model: string;
          embeddingVersion: string;
        }>
      >`
        SELECT
          s.id AS "signalId",
          s.title,
          s."canonicalUrl" AS url,
          s."signalType",
          GREATEST(LEAST(1 - (e.embedding <=> ${vectorLiteral(vector)}::vector), 1), -1) AS similarity,
          e.provider,
          e.model,
          e."embeddingVersion"
        FROM "SignalEmbedding" e
        JOIN "Signal" s ON s.id = e."signalId"
        ${where}
        ORDER BY similarity DESC, s.id ASC
        LIMIT ${args.limit}
      `;
      return rows;
    },

    async searchKeyword(args) {
      const where = whereSql(
        [
          Prisma.sql`to_tsvector(
            'english',
            coalesce(s.title, '') || ' ' ||
            coalesce(s.summary, '') || ' ' ||
            array_to_string(s.domains, ' ') || ' ' ||
            array_to_string(s.technologies, ' ') || ' ' ||
            array_to_string(s.keywords, ' ')
          ) @@ websearch_to_tsquery('english', ${args.query})`,
        ],
        args.filters
      );
      return prisma.$queryRaw<
        Array<{ signalId: string; title: string; url: string; signalType: string; score: number }>
      >`
        SELECT
          s.id AS "signalId",
          s.title,
          s."canonicalUrl" AS url,
          s."signalType",
          ts_rank(
            to_tsvector(
              'english',
              coalesce(s.title, '') || ' ' ||
              coalesce(s.summary, '') || ' ' ||
              array_to_string(s.domains, ' ') || ' ' ||
              array_to_string(s.technologies, ' ') || ' ' ||
              array_to_string(s.keywords, ' ')
            ),
            websearch_to_tsquery('english', ${args.query})
          ) AS score
        FROM "Signal" s
        ${where}
        ORDER BY score DESC, s.id ASC
        LIMIT ${args.limit}
      `;
    },
  };
}
