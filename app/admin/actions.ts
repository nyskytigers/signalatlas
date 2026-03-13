// app/admin/actions.ts
"use server";

import { runRssIngest } from "@/lib/ingest/runRssIngest";
import { runArxivIngest } from "@/lib/ingest/runArxivIngest";
import { runGithubIngest } from "@/lib/ingest/runGithubIngest";
import { runYoutubeIngest } from "@/lib/ingest/runYoutubeIngest";
import { runWebIngest } from "@/lib/ingest/runWebIngest";
import { revalidatePath } from "next/cache";

export async function runIngestAction(kind: string) {
  if (kind === "rss") await runRssIngest();
  else if (kind === "arxiv") await runArxivIngest();
  else if (kind === "github") await runGithubIngest();
  else if (kind === "youtube") await runYoutubeIngest();
  else if (kind === "web") await runWebIngest();
  else if (kind === "all") {
    await runRssIngest();
    await runArxivIngest();
    await runGithubIngest();
    await runYoutubeIngest();
    await runWebIngest();
  } else {
    throw new Error(`Unknown ingest kind: ${kind}`);
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/trending");
}