// app/api/ingest/all/route.ts
import { NextResponse } from "next/server";

import { runRssIngest } from "@/lib/ingest/runRssIngest";
import { runArxivIngest } from "@/lib/ingest/runArxivIngest";
import { runGithubIngest } from "@/lib/ingest/runGithubIngest";
import { runYoutubeIngest } from "@/lib/ingest/runYoutubeIngest";
import { runWebIngest } from "@/lib/ingest/runWebIngest";

export async function POST() {
  console.log("Starting full ingest pipeline");

  const results: Record<string, unknown> = {};

  try {
    results.rss = await runRssIngest();
  } catch (err) {
    console.error("RSS ingest failed", err);
    results.rss = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  try {
    results.arxiv = await runArxivIngest();
  } catch (err) {
    console.error("arXiv ingest failed", err);
    results.arxiv = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  try {
    results.github = await runGithubIngest();
  } catch (err) {
    console.error("GitHub ingest failed", err);
    results.github = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  try {
    results.youtube = await runYoutubeIngest();
  } catch (err) {
    console.error("YouTube ingest failed", err);
    results.youtube = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  try {
    results.web = await runWebIngest();
  } catch (err) {
    console.error("Web ingest failed", err);
    results.web = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  console.log("Full ingest pipeline complete", results);

  return NextResponse.json({
    ok: true,
    results,
  });
}