// app/topics/[tag]/page.tsx
import FeedList from "@/components/feed/FeedList";
import { getItemsByTag } from "@/lib/queries/topics";

type PageProps = {
  params: Promise<{
    tag: string;
  }>;
};

export default async function TopicPage({ params }: PageProps) {
  const { tag } = await params;
  const items = await getItemsByTag(tag);

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
          <h1>#{tag}</h1>

          <p>
            Ranked items tagged with &quot;{tag}&quot;.
          </p>
        </header>

        <FeedList items={feedItems} />
      </main>
    );
}