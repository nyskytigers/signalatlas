import "dotenv/config";
import { prisma } from "../db/prisma";
import { backfillSignalEmbeddings } from "../lib/ai/embeddings";

type Args = {
  signalId: string | null;
  limit: number;
  force: boolean;
  dryRun: boolean;
  onlyMissing: boolean;
};

function parseArgs(argv: readonly string[]): Args {
  let signalId: string | null = null;
  let limit = 25;
  let force = false;
  let dryRun = false;
  let onlyMissing = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--signal-id") {
      signalId = argv[index + 1] ?? null;
      index += 1;
    } else if (arg === "--limit") {
      const parsed = Number(argv[index + 1]);
      if (Number.isInteger(parsed) && parsed > 0) limit = Math.min(parsed, 100);
      index += 1;
    } else if (arg === "--force") {
      force = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--only-missing") {
      onlyMissing = true;
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
  }

  return { signalId, limit, force, dryRun, onlyMissing };
}

function printUsage() {
  console.log(
    "Usage: npm run embeddings:backfill -- [--limit 25] [--signal-id <id>] [--force] [--dry-run] [--only-missing]"
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const results = await backfillSignalEmbeddings({
    signalIds: args.signalId ? [args.signalId] : undefined,
    limit: args.signalId ? 1 : args.limit,
    force: args.force,
    dryRun: args.dryRun,
    onlyMissing: args.onlyMissing,
  });
  const summary = {
    total: results.length,
    success: results.filter((result) => result.status === "SUCCESS").length,
    skipped: results.filter((result) => result.status === "SKIPPED").length,
    failed: results.filter((result) => result.status === "FAILED").length,
    disabled: results.filter((result) => result.status === "DISABLED").length,
  };
  console.log(JSON.stringify({ summary, results }, null, 2));
  if (summary.failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          status: "failed",
          message: error instanceof Error ? error.message : String(error),
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
