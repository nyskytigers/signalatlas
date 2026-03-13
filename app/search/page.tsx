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
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            Search
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-zinc-950">
            Search signals
          </h1>
        </header>

        <form method="GET" className="mb-6 flex gap-3">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search papers, repos, videos, topics..."
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm"
          />
          <button
            type="submit"
            className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Search
          </button>
        </form>

        {q ? (
          <p className="mb-4 text-sm text-zinc-500">
            Results for{" "}
            <span className="font-medium text-zinc-900">{q}</span>:{" "}
            {feedItems.length}
          </p>
        ) : (
          <p className="mb-4 text-sm text-zinc-500">
            Try searching for robotics, slam, underwater, telepresence, or a lab name.
          </p>
        )}

        <FeedList items={feedItems} />
      </div>
    </main>
  );
}