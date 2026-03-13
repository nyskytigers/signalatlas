// app/labs/page.tsx
import LabCard from "@/components/labs/LabCard";
import { getAllLabs } from "@/lib/queries/labs";

export default async function LabsPage() {
  const labs = await getAllLabs();

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
            Labs
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">
            Research labs tracked by SignalAtlas
          </h1>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {labs.map((lab) => (
            <LabCard key={lab.id} lab={lab} />
          ))}
        </div>
      </div>
    </main>
  );
}