// app/api/ingest/youtube/route.ts
import { NextResponse } from "next/server";
import { runYoutubeIngest } from "@/lib/ingest/runYoutubeIngest";

export async function POST() {
  const result = await runYoutubeIngest();
  return NextResponse.json({ ok: true, result });
}