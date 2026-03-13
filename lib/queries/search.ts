//lib/queries/search.ts
import { prisma } from "@/db/prisma";

export async function searchItems(query: string) {
  const q = query.trim();
  if (!q) return [];

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      rank: number;
    }>
  >(
    `
    SELECT
      id,
      ts_rank(
        to_tsvector(
          'english',
          coalesce(title, '') || ' ' ||
          coalesce(summary, '') || ' ' ||
          coalesce("contentText", '') || ' ' ||
          array_to_string(tags, ' ')
        ),
        websearch_to_tsquery('english', $1)
      ) AS rank
    FROM "Item"
    WHERE to_tsvector(
      'english',
      coalesce(title, '') || ' ' ||
      coalesce(summary, '') || ' ' ||
      coalesce("contentText", '') || ' ' ||
      array_to_string(tags, ' ')
    ) @@ websearch_to_tsquery('english', $1)
    ORDER BY rank DESC
    LIMIT 50
    `,
    q
  );

  const ids = rows.map((r) => r.id);
  if (!ids.length) return [];

  const items = await prisma.item.findMany({
    where: { id: { in: ids } },
    include: { lab: true, source: true },
  });

  const byId = new Map(items.map((item) => [item.id, item]));
  return rows.map((row) => byId.get(row.id)).filter(Boolean);
}