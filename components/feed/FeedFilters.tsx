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
    <form method="GET" className="feed-filters">
      <div className="filter-group">
        <label htmlFor="type">Type</label>

        <select
          id="type"
          name="type"
          defaultValue={currentType}
          className="filter-select"
        >
          <option value="all">All</option>
          {SOURCE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="time">Time window</label>

        <select
          id="time"
          name="time"
          defaultValue={currentTime}
          className="filter-select"
        >
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="lab">Lab</label>

        <select
          id="lab"
          name="lab"
          defaultValue={currentLab}
          className="filter-select"
        >
          <option value="all">All labs</option>
          {labs.map((lab) => (
            <option key={lab.slug} value={lab.slug}>
              {lab.name}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-actions">
        <button type="submit">Apply</button>

        <Link href="/">Reset</Link>
      </div>
    </form>
  );
}