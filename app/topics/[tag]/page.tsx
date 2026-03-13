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

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            Topic
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-zinc-950">
            #{tag}
          </h1>
          <p className="mt-3 text-base text-zinc-600">
            Ranked items tagged with {tag}.
          </p>
        </header>

        <FeedList items={items} />
      </div>
    </main>
  );
}