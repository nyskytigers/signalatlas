// app/search/page.tsx
import FeedList from "@/components/feed/FeedList";
import { searchItems } from "@/lib/queries/search";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function SearchPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() || "";
  const items = q ? await searchItems(q) : [];

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
    <main>
      <header className="feed-header">
        <h1>Search</h1>
        <p>Search papers, repositories, videos, and labs.</p>
      </header>

      <form method="GET" className="utility-section flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="robotics, slam, digital twin..."
          className="flex-1 border px-2 py-1"
        />

        <button type="submit">
          Search
        </button>
      </form>

      <p className="utility-muted">
        {q
          ? `${feedItems.length} results for "${q}"`
          : "Try: robotics, XR, underwater, telepresence"}
      </p>

      <FeedList items={feedItems} />
    </main>
  );
}