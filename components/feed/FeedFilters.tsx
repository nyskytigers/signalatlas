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
  currentType = "all",
  currentTime = "7d",
  currentLab = "all",
  labs,
}: FeedFiltersProps) {
  return (
    <form
      method="GET"
      className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-[repeat(3,minmax(0,1fr))_auto]"
    >
      <div className="grid min-w-0 gap-1">
        <label htmlFor="type" className="text-sm font-medium text-zinc-700">
          Type
        </label>
          <select
            id="type"
            name="type"
            defaultValue={currentType}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="all">All</option>

            {SOURCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
      </div>

      <div className="grid min-w-0 gap-1">
        <label htmlFor="time" className="text-sm font-medium text-zinc-700">
          Time window
        </label>
        <select
          id="time"
          name="time"
          defaultValue={currentTime}
          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      <div className="grid min-w-0 gap-1">
        <label htmlFor="lab" className="text-sm font-medium text-zinc-700">
          Lab
        </label>
        <select
          id="lab"
          name="lab"
          defaultValue={currentLab}
          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="all">All labs</option>
          {labs.map((lab) => (
            <option key={lab.slug} value={lab.slug}>
              {lab.name}
            </option>
          ))}
        </select>
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
          className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}