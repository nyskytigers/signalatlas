// app/api/ingest/arxiv/route.ts
import { NextResponse } from "next/server";
import { runArxivIngest } from "@/lib/ingest/runArxivIngest";

export async function POST() {
  try {
    const result = await runArxivIngest();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown ingest error";

    return NextResponse.json(
      { ok: false, inserted: 0, skipped: 0, errors: 1, error: message },
      { status: 500 }
    );
  }
}