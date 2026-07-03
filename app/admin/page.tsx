// app/admin/page.tsx
import {
  getAdminStats,
  getRecentIngestRuns,
  getSourceHealth,
} from "@/lib/queries/admin";
import { runIngestAction } from "./actions";

export default async function AdminPage() {
  const [stats, runs, sources] = await Promise.all([
    getAdminStats(),
    getRecentIngestRuns(),
    getSourceHealth(),
  ]);

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="feed-header">
          <h1>Control Room</h1>

          <p>
            Manual ingest triggers, recent runs, and source health.
          </p>
        </header>

        <section className="utility-section">
          <h2>System Stats</h2>

          <table className="utility-table">
            <tbody>
              <tr>
                <th>Labs</th>
                <td>{stats.labs}</td>
              </tr>

              <tr>
                <th>Sources</th>
                <td>{stats.sources}</td>
              </tr>

              <tr>
                <th>Items</th>
                <td>{stats.items}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="utility-section">
          <h2>Run Ingest</h2>

          <div className="feed-tags mt-4">
            {["rss", "arxiv", "github", "youtube", "web", "all"].map(
              (kind) => (
                <form
                  key={kind}
                  action={runIngestAction.bind(null, kind)}
                >
                  <button type="submit">
                    run {kind}
                  </button>
                </form>
              )
            )}
          </div>
        </section>

        <section className="utility-section">
          <h2>Recent Ingest Runs</h2>

          <div className="utility-list">
            {runs.map((run) => (
              <article key={run.id} className="feed-row">
                <div className="feed-rank">•</div>

                <div>
                  <div className="feed-title">
                    {run.type} · {run.status}
                  </div>

                  <div className="feed-meta">
                    {new Date(run.startedAt).toLocaleString()}
                  </div>

                  <div className="feed-meta">
                    sources {run.sourcesCount}
                    {" • "}
                    fetched {run.fetchedCount}
                    {" • "}
                    created {run.createdCount}
                    {" • "}
                    deduped {run.dedupedCount}
                    {" • "}
                    failed {run.failedCount}
                  </div>

                  {run.error ? (
                    <p className="mt-2 text-red-500">
                      {run.error}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="utility-list">
          {sources.map((src) => (
            <article key={src.id} className="feed-row">
              <div className="feed-rank">•</div>

              <div>
                <div className="feed-title">
                  {src.name || src.url}
                </div>

                <div className="feed-meta">
                  {src.lab.name}
                  {" • "}
                  {src.type}
                </div>

                <div className="feed-meta">
                  {src.url}
                </div>

                <div className="feed-meta">
                  checked:{" "}
                  {src.lastCheckedAt
                    ? new Date(src.lastCheckedAt).toLocaleString()
                    : "never"}

                  {" • "}

                  ok:{" "}
                  {src.lastOkAt
                    ? new Date(src.lastOkAt).toLocaleString()
                    : "never"}
                </div>

                {src.lastError ? (
                  <p className="mt-2 text-red-500">
                    {src.lastError}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}