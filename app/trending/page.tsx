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
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            Trending
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-zinc-950">
            Trending signals
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-600">
            High-scoring recent updates across papers, repos, videos, and lab feeds.
          </p>
        </header>

        <FeedList items={feedItems} />
      </div>
    </main>
  );
}