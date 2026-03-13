// app/api/debug/db/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.DATABASE_URL ?? "";
  const safeUrl = url.replace(/:(.*?)@/, ":****@");
  return NextResponse.json({ databaseUrl: safeUrl });
}