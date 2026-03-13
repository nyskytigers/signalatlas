// components/labs/LabCard.tsx
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
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">
        <a href={`/labs/${lab.slug}`} className="hover:underline">
          {lab.name}
        </a>
      </h2>

      <p className="mt-2 text-sm text-zinc-600">
        {lab.org || "Unknown org"}
        {lab.country ? ` · ${lab.country}` : ""}
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-sm text-zinc-500">
        <span className="rounded-full bg-zinc-100 px-2 py-1">{lab.domain}</span>
        <span className="rounded-full bg-zinc-100 px-2 py-1">
          {lab._count.items} items
        </span>
        <span className="rounded-full bg-zinc-100 px-2 py-1">
          {lab._count.sources} sources
        </span>
      </div>
    </article>
  );
}