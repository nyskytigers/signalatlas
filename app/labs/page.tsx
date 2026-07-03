// app/labs/page.tsx
import LabCard from "@/components/labs/LabCard";
import { getAllLabs } from "@/lib/queries/labs";

export default async function LabsPage() {
  const labs = await getAllLabs();

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
       <header className="feed-header">
        <h1>Research Labs</h1>
        <p>
          Labs currently tracked by SignalAtlas.
        </p>
      </header>

        <section className="utility-section">
          <div className="utility-list">
            {labs.map((lab) => (
              <LabCard key={lab.id} lab={lab} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}