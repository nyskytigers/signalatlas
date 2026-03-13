// app/api/ingest/rss/route.ts
import { NextResponse } from "next/server";
import { runRssIngest } from "@/lib/ingest/runRssIngest";

export async function POST() {
  const result = await runRssIngest();
  return NextResponse.json({ ok: true, ...result });
}