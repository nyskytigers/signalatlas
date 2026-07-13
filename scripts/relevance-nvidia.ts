import "dotenv/config";
import { prisma } from "../db/prisma";
import {
  assessSignalWithNvidia,
  normalizeAssessmentInput,
  NvidiaProviderDisabledError,
} from "../lib/ai/relevance";

type CliArgs = {
  signalId: string | null;
  dryRun: boolean;
  storeRawResponse: boolean;
};

function parseArgs(argv: readonly string[]): CliArgs {
  let signalId: string | null = null;
  let dryRun = false;
  let storeRawResponse = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--signal-id") {
      signalId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--store-raw-response") {
      storeRawResponse = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
  }

  return { signalId, dryRun, storeRawResponse };
}

function printUsage() {
  console.log("Usage: npm run relevance:nvidia -- --signal-id <id> [--dry-run] [--store-raw-response]");
}

function errorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return "unknown_error";
}

async function dryRun(signalId: string) {
  const signal = await prisma.signal.findUnique({
    where: { id: signalId },
    select: {
      id: true,
      title: true,
      summary: true,
      canonicalUrl: true,
      signalType: true,
      sourceName: true,
      publishedAt: true,
      technologies: true,
      organizations: true,
      researchers: true,
      domains: true,
      keywords: true,
    },
  });

  if (!signal) {
    throw new Error(`Signal not found: ${signalId}`);
  }

  const normalized = normalizeAssessmentInput({
    signalId: signal.id,
    title: signal.title,
    summary: signal.summary,
    signalType: signal.signalType,
    sourceName: signal.sourceName,
    canonicalUrl: signal.canonicalUrl,
    publishedAt: signal.publishedAt,
    technologies: signal.technologies,
    organizations: signal.organizations,
    researchers: signal.researchers,
    domains: signal.domains,
    keywords: signal.keywords,
  });

  console.log(JSON.stringify({ dryRun: true, input: normalized }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.signalId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (args.dryRun) {
    await dryRun(args.signalId);
    return;
  }

  const result = await assessSignalWithNvidia(args.signalId, {
    storeRawResponse: args.storeRawResponse,
  });
  console.log(
    JSON.stringify(
      {
        status: result.status,
        assessmentId: result.id,
        signalId: result.signalId,
        provider: result.provider,
        model: result.model,
        finalScore: result.finalScore,
        band: result.band,
        normalizedConfidence: result.normalizedConfidence,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    const disabled = error instanceof NvidiaProviderDisabledError;
    console.error(
      JSON.stringify(
        {
          status: "failed",
          code: disabled ? "provider_disabled" : errorCode(error),
          message,
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
