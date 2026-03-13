// app/api/ingest/route.ts
import { NextResponse } from "next/server";
import { runRssIngest } from "@/lib/ingest/runRssIngest";
import { runArxivIngest } from "@/lib/ingest/runArxivIngest";
import { runGithubIngest } from "@/lib/ingest/runGithubIngest";
import { runYoutubeIngest } from "@/lib/ingest/runYoutubeIngest";

export async function POST() {
  const results = await Promise.allSettled([
    runRssIngest(),
    runArxivIngest(),
    runGithubIngest(),
    runYoutubeIngest(),
  ]);

  return NextResponse.json({
    ok: true,
    results: {
      rss: results[0],
      arxiv: results[1],
      github: results[2],
      youtube: results[3],
    },
  });
}