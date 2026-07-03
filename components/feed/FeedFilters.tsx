// components/feed/FeedFilters.tsx
import Link from "next/link";

type FeedFiltersProps = {
  currentType?: string;
  currentTime?: string;
  currentLab?: string;
  labs: Array<{
    slug: string;
    name: string;
  }>;
};

const SOURCE_TYPES = [
  { value: "RSS", label: "RSS" },
  { value: "ARXIV", label: "arXiv Papers" },
  { value: "WEBSITE", label: "Lab Websites" },
  { value: "GITHUB", label: "GitHub" },
  { value: "YOUTUBE", label: "YouTube" },
];

export default function FeedFilters({
  labs,
}: FeedFiltersProps) {
  
  return (
    <form
      method="GET"
     className="utility-section utility-table"
    >
      <div className="grid min-w-0 gap-1">
        <label htmlFor="type" className="text-sm font-medium text-zinc-700">
          Type
        </label>
          <button
            type="submit"
            className="border px-3 py-1"
          >
            <option value="all">All</option>

            {SOURCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </button>
      </div>

      <div className="grid min-w-0 gap-1">
        <label htmlFor="time" className="text-sm font-medium text-zinc-700">
          Time window
        </label>
          <button
            type="submit"
            className="border px-3 py-1"
          >
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </button>
      </div>

      <div className="grid min-w-0 gap-1">
        <label htmlFor="lab" className="text-sm font-medium text-zinc-700">
          Lab
        </label>
          <button
            type="submit"
            className="border px-3 py-1"
          >
          <option value="all">All labs</option>
          {labs.map((lab) => (
            <option key={lab.slug} value={lab.slug}>
              {lab.name}
            </option>
          ))}
        </button>
      </div>

      <div className="flex items-end justify-end gap-2 whitespace-nowrap">
        <button
          type="submit"
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Apply
        </button>

        <Link
          href="/"
          className="border px-3 py-1"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}