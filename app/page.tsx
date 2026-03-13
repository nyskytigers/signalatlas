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

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8">
          {/* <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            SignalAtlas
          </p> */}
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-zinc-950">
            Ranked research signals from XR and marine robotics labs
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-600">
            Track what leading labs are publishing, announcing, and building
            without checking fifty tabs like a caffeinated raccoon.
          </p>
        </header>

        <div className="mb-6">
          <FeedFilters
            currentType={params.type}
            currentTime={params.time ?? "7d"}
            currentLab={params.lab}
            labs={labs.map((lab) => ({
              slug: lab.slug,
              name: lab.name,
            }))}
          />
        </div>

        <section className="mb-4">
          <p className="text-sm text-zinc-500">
            Showing <span className="font-semibold text-zinc-900">{items.length}</span> ranked items
          </p>
        </section>

        <FeedList items={items} />
      </div>
    </main>
  );
}