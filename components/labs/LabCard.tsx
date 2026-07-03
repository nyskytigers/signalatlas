// components/labs/LabCard.tsx
import Link from "next/link";

type LabCardProps = {
  lab: {
    slug: string;
    name: string;
    org: string | null;
    country: string | null;
    domain: string;
    _count: {
      items: number;
      sources: number;
    };
  };
};

export default function LabCard({ lab }: LabCardProps) {
  return (
    <article className="feed-row">
      <div className="feed-rank">•</div>

      <div>
        <h2>
          <Link
            href={`/labs/${lab.slug}`}
            className="feed-title"
          >
            {lab.name}
          </Link>
        </h2>

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
      </div>
    </article>
  );
}