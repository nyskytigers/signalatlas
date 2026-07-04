// app/page.tsx
import FeedFilters from "@/components/feed/FeedFilters";
import FeedList from "@/components/feed/FeedList";
import { getHomepageItems } from "@/lib/queries/items";
import { getAllLabs } from "@/lib/queries/labs";

type PageProps = {
  searchParams?: Promise<{
    type?: string;
    time?: string;
    lab?: string;
  }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};

  const [items, labs] = await Promise.all([
    getHomepageItems({
      type: params.type,
      time: params.time ?? "7d",
      lab: params.lab,
    }),
    getAllLabs(),
  ]);

  const feedItems = items.map((item) => ({
    ...item,
    source: {
      name: item.source?.name ?? "Unknown source",
      type: item.source?.type ?? "UNKNOWN",
    },
  }));

  return (
    <section className="feed-shell">
      <header className="feed-header">
        <h1>SignalAtlas</h1>
        <p className="feed-description">
          Ranked research signals from XR, marine robotics, HCI, digital twin, and marine archaeology labs.
        </p>
      </header>

      <FeedFilters
        currentType={params.type}
        currentTime={params.time ?? "7d"}
        currentLab={params.lab}
        labs={labs.map((lab) => ({
          slug: lab.slug,
          name: lab.name,
        }))}
      />

      <section className="utility-section">
        <p className="utility-muted">
          Showing {feedItems.length} ranked items
        </p>
      </section>

      <FeedList items={feedItems} />
    </section>
  );
}