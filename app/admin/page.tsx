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
        <header className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            Admin
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-zinc-950">
            SignalAtlas control room
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-600">
            Manual ingest triggers, recent runs, and source health.
          </p>
        </header>

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-zinc-500">Labs</div>
            <div className="mt-2 text-3xl font-semibold text-zinc-950">
              {stats.labs}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-zinc-500">Sources</div>
            <div className="mt-2 text-3xl font-semibold text-zinc-950">
              {stats.sources}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-zinc-500">Items</div>
            <div className="mt-2 text-3xl font-semibold text-zinc-950">
              {stats.items}
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Run ingest</h2>

          <div className="mt-4 flex flex-wrap gap-3">
            {["rss", "arxiv", "github", "youtube", "web", "all"].map((kind) => (
              <form key={kind} action={runIngestAction.bind(null, kind)}>
                <button
                  type="submit"
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Run {kind}
                </button>
              </form>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">
            Recent ingest runs
          </h2>
          <div className="grid gap-4">
            {runs.map((run) => (
              <div
                key={run.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-700">
                    {run.type}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-700">
                    {run.status}
                  </span>
                  <span>{new Date(run.startedAt).toLocaleString()}</span>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-zinc-600 md:grid-cols-3">
                  <div>sources: {run.sourcesCount}</div>
                  <div>fetched: {run.fetchedCount}</div>
                  <div>created: {run.createdCount}</div>
                  <div>deduped: {run.dedupedCount}</div>
                  <div>failed: {run.failedCount}</div>
                </div>

                {run.error ? (
                  <p className="mt-3 text-sm text-red-600">{run.error}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">
            Source health
          </h2>
          <div className="grid gap-4">
            {sources.map((src) => (
              <div
                key={src.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="text-sm text-zinc-500">
                  {src.lab.name} · {src.type}
                </div>
                <div className="mt-1 text-base font-medium text-zinc-900">
                  {src.name || src.url}
                </div>
                <div className="mt-2 break-all text-sm text-zinc-600">
                  {src.url}
                </div>

                <div className="mt-3 flex flex-wrap gap-3 text-sm text-zinc-500">
                  <span>
                    last checked:{" "}
                    {src.lastCheckedAt
                      ? new Date(src.lastCheckedAt).toLocaleString()
                      : "never"}
                  </span>
                  <span>
                    last ok:{" "}
                    {src.lastOkAt
                      ? new Date(src.lastOkAt).toLocaleString()
                      : "never"}
                  </span>
                </div>

                {src.lastError ? (
                  <p className="mt-3 text-sm text-red-600">{src.lastError}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}