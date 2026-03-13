// app/api/ingest/web/route.ts
import { NextResponse } from "next/server";
import { runWebIngest } from "@/lib/ingest/runWebIngest";

export async function POST() {
  const result = await runWebIngest();
  return NextResponse.json({ ok: true, result });
}