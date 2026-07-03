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
    <main>
      <header className="feed-header">
        <h1>{lab.name}</h1>

        <p className="feed-meta">
          {lab.org || "Unknown organization"}
          {lab.country ? ` • ${lab.country}` : ""}
          {" • "}
          {lab.domain}
          {" • "}
          {lab._count.items} items
          {" • "}
          {lab._count.sources} sources
        </p>

        {lab.description ? <p>{lab.description}</p> : null}

        {lab.homepageUrl ? (
          <p>
            <a href={lab.homepageUrl} target="_blank" rel="noreferrer">
              Visit homepage
            </a>
          </p>
        ) : null}
      </header>

      <section className="utility-section">
        <h2>Latest signals</h2>
        <p className="utility-muted">Ranked updates associated with this lab</p>
      </section>

      <FeedList items={feedItems} />
    </main>
  );
}