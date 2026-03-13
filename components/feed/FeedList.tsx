// components/feed/FeedList.tsx
import { FeedItem } from "@/types/feed";
import Link from "next/link";

type FeedListProps = {
  items: FeedItem[];
};

export default function FeedList({ items }: FeedListProps) {
  return (
    <div className="space-y-4">
      {items.map((item) => {
        const dateText = new Date(
          item.publishedAt ?? item.createdAt
        ).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        return (
          <div
            key={item.id}
            className="flex gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-zinc-300"
          >
            <div className="w-12 text-center">
              <div className="text-lg font-semibold text-zinc-900">
                {Math.round(item.score ?? 0)}
              </div>
              <div className="text-xs text-zinc-500">score</div>
            </div>

            <div className="min-w-0 flex-1">
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-base font-medium text-zinc-900 hover:underline"
                >
                  {item.title}
                </a>
              ) : (
                <div className="text-base font-medium text-zinc-900">
                  {item.title}
                </div>
              )}

              <div className="mt-1 text-sm text-zinc-500">
                <Link
                  href={`/labs/${item.lab.slug}`}
                  className="font-medium text-zinc-600 hover:text-zinc-900 hover:underline"
                >
                  {item.lab.name}
                </Link>
                {" • "}
                {item.source?.name ?? item.source?.type ?? "UNKNOWN"}
                {" • "}
                {dateText}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}