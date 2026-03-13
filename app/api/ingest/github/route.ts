// app/api/ingest/github/route.ts
import { NextResponse } from "next/server";
import { runGithubIngest } from "@/lib/ingest/runGithubIngest";

export async function POST() {
  const result = await runGithubIngest();
  return NextResponse.json({ ok: true, result });
}