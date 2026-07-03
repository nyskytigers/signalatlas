// components/feed/FeedList.tsx
import { FeedItem } from "@/types/feed";
import Link from "next/link";

type FeedListProps = {
  items: FeedItem[];
};

export default function FeedList({ items }: FeedListProps) {
  return (
    <div className="feed-list">
      {items.map((item, index) => {
      const fallbackDate = item.publishedAt ?? item.createdAt;
      const dateText = fallbackDate
        ? new Date(fallbackDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Unknown date";

        return (
          <article key={item.id} className="feed-row">
            <div className="feed-rank">{index + 1}.</div>

            <div>
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="feed-title"
                >
                  {item.title}
                </a>
              ) : (
                <div className="feed-title">{item.title}</div>
              )}

            <div className="feed-meta">
              {item.lab ? (
                <Link href={`/labs/${item.lab.slug}`}>
                  {item.lab.name}
                </Link>
              ) : (
                <span>Unknown Lab</span>
              )}

              <span>{item.source?.name ?? "Unknown Source"}</span>
              <span>{dateText}</span>
            </div>

              {item.tags?.length ? (
                <div className="feed-tags">
                  {item.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/topics/${tag}`}
                      className="feed-tag"
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}