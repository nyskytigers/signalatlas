// app/labs/[slug]/page.tsx
import { notFound } from "next/navigation";
import FeedList from "@/components/feed/FeedList";
import { getItemsForLab, getLabBySlug } from "@/lib/queries/labs";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function LabDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const [lab, items] = await Promise.all([
    getLabBySlug(slug),
    getItemsForLab(slug),
  ]);

  if (!lab) notFound();

  const feedItems = items.map((item) => ({
    ...item,
    source: {
      name: item.source?.name ?? "Unknown source",
      type: item.source?.type ?? "UNKNOWN",
    },
  }));

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            Lab Profile
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">
            {lab.name}
          </h1>

          <p className="mt-3 text-zinc-600">
            {lab.org || "Unknown organization"}
            {lab.country ? ` · ${lab.country}` : ""}
          </p>

          {lab.description ? (
            <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-600">
              {lab.description}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700">
              {lab.domain}
            </span>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700">
              {lab._count.items} items
            </span>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700">
              {lab._count.sources} sources
            </span>
          </div>

          {lab.homepageUrl ? (
            <div className="mt-5">
              <a
                href={lab.homepageUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-zinc-900 hover:underline"
              >
                Visit homepage
              </a>
            </div>
          ) : null}
        </div>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-zinc-900">Latest signals</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Ranked updates associated with this lab
          </p>
        </section>

        <FeedList items={feedItems} />
      </div>
    </main>
  );
}