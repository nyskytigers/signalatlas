import "dotenv/config";
import { prisma } from "../db/prisma";
import {
  searchSignalsByEmbedding,
  searchSignalsHybrid,
  type SemanticSearchFilters,
} from "../lib/ai/embeddings";

type Args = {
  query: string | null;
  limit: number;
  mode: "semantic" | "hybrid";
  filters: SemanticSearchFilters;
};

function parseArgs(argv: readonly string[]): Args {
  let query: string | null = null;
  let limit = 10;
  let mode: "semantic" | "hybrid" = "semantic";
  const filters: SemanticSearchFilters = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--query") {
      query = argv[index + 1] ?? null;
      index += 1;
    } else if (arg === "--limit") {
      const parsed = Number(argv[index + 1]);
      if (Number.isInteger(parsed) && parsed > 0) limit = Math.min(parsed, 50);
      index += 1;
    } else if (arg === "--mode") {
      const value = argv[index + 1];
      if (value === "semantic" || value === "hybrid") mode = value;
      index += 1;
    } else if (arg === "--domain") {
      filters.domain = argv[index + 1];
      index += 1;
    } else if (arg === "--technology") {
      filters.technology = argv[index + 1];
      index += 1;
    } else if (arg === "--type") {
      filters.signalType = argv[index + 1];
      index += 1;
    } else if (arg === "--source") {
      filters.sourceName = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
  }

  return { query, limit, mode, filters };
}

function printUsage() {
  console.log(
    'Usage: npm run signals:semantic-search -- --query "underwater SLAM using NeRF" [--limit 10] [--mode semantic|hybrid]'
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.query) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const results =
    args.mode === "hybrid"
      ? await searchSignalsHybrid({
          query: args.query,
          limit: args.limit,
          filters: args.filters,
        })
      : await searchSignalsByEmbedding({
          query: args.query,
          limit: args.limit,
          filters: args.filters,
        });

  const output = results.map((result, index) =>
    "signal" in result
      ? {
          rank: index + 1,
          title: result.signal.title,
          signalId: result.signal.id,
          url: result.signal.url,
          semanticScore: result.semanticScore,
          keywordScore: result.keywordScore,
          hybridScore: result.hybridScore,
          matchedBy: result.matchedBy,
          model: result.model,
          embeddingVersion: result.embeddingVersion,
        }
      : {
          rank: index + 1,
          title: result.title,
          signalId: result.signalId,
          url: result.url,
          semanticScore: result.similarity,
          model: result.model,
          embeddingVersion: result.embeddingVersion,
        }
  );

  console.log(JSON.stringify({ query: args.query, mode: args.mode, results: output }, null, 2));
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
