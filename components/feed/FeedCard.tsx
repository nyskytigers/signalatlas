// components/feed/FeedCard.tsx
type FeedCardProps = {
  item: {
    id: string;
    title: string;
    summary: string | null;
    url: string;
    score: number;
    publishedAt: Date | null;
    tags: string[];
    sourceName: string | null;
    lab: {
      name: string;
      slug: string;
    };
    source: {
      type: string;
    } | null;
  };
};

function formatDate(date: Date | null) {
  if (!date) return "No date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default function FeedCard({ item }: FeedCardProps) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
        <span className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-700">
          score {Math.round(item.score)}
        </span>

        <span>{item.lab.name}</span>
        <span>·</span>
        <span>{item.source?.type ?? "UNKNOWN"}</span>
        <span>·</span>
        <span>{item.sourceName}</span>
        <span>·</span>
        <span>{formatDate(item.publishedAt)}</span>
      </div>

      <h2 className="text-lg font-semibold leading-snug text-zinc-900">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
        >
          {item.title}
        </a>
      </h2>

      {item.summary ? (
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-600">
          {item.summary}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {item.tags?.slice(0, 6).map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-600"
          >
            #{tag}
          </span>
        ))}
      </div>

      <div className="mt-4">
        <a
          href={`/labs/${item.lab.slug}`}
          className="text-sm font-medium text-zinc-900 hover:underline"
        >
          View lab
        </a>
      </div>
    </article>
  );
}