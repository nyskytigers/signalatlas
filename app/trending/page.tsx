// app/trending/page.tsx
import FeedList from "@/components/feed/FeedList";
import { getTrendingItems } from "@/lib/queries/trending";

export default async function TrendingPage() {
  const items = await getTrendingItems();

  const feedItems = items
    .filter((item): item is NonNullable<typeof item> => item != null)
    .map((item) => ({
      ...item,
      source: {
        name: item.source?.name ?? "Unknown source",
        type: item.source?.type ?? "UNKNOWN",
      },
    }));

  return (
    <main >
        <header className="feed-header">
          <h1>Trending Signals</h1>

          <p>
            High-scoring recent updates across papers, repositories,
            videos, and lab feeds.
          </p>
        </header>

        <FeedList items={feedItems} />   
    </main>
  );
}