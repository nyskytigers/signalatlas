import type { Prisma, Signal as PersistedSignal } from "@prisma/client";
import type { MinimalExistingSignal } from "../dedupe";
import type { SignalProcessingResult } from "../orchestration";
import type { SignalType } from "../types";

export type SignalPersistenceStatus =
  | "created"
  | "updated"
  | "review_required"
  | "skipped"
  | "dry_run"
  | "disabled";

export type SignalPersistenceOperation = "create" | "update" | "none";

export type PersistedSignalSummary = {
  id: string;
  canonicalUrl: string;
};

export type SignalPersistenceResult = {
  processing: SignalProcessingResult;
  status: SignalPersistenceStatus;
  persistedSignal?: PersistedSignalSummary;
  intendedOperation?: SignalPersistenceOperation;
};

export type SignalDuplicateCandidate = MinimalExistingSignal;

export type SignalForUpdate = MinimalExistingSignal & {
  summary?: string | null;
  sourceId?: string | null;
  sourceName?: string | null;
  publishedAt?: Date | null;
  technologies?: string[];
  organizations?: string[];
  researchers?: string[];
  domains?: string[];
  keywords?: string[];
  relevanceScore?: number | null;
  signalType?: SignalType | string;
};

export type SignalDatabaseClient = {
  signal: {
    findMany(args: Prisma.SignalFindManyArgs): Promise<SignalDuplicateCandidate[]>;
    findUnique(args: Prisma.SignalFindUniqueArgs): Promise<SignalForUpdate | null>;
    upsert(args: Prisma.SignalUpsertArgs): Promise<PersistedSignal>;
    update(args: Prisma.SignalUpdateArgs): Promise<PersistedSignal>;
  };
};

export type ProcessAndPersistOptions = {
  client?: SignalDatabaseClient;
  dryRun?: boolean;
  existingSignals?: SignalForUpdate[];
  env?: Record<string, string | undefined>;
};
