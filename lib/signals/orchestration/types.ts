import type { DuplicateMatch } from "../dedupe";
import type { EntityExtractionResult } from "../entities";
import type { SignalInput } from "../types";

export type SignalProcessingAction = "create" | "update" | "skip" | "review";

export type SignalProcessingStage =
  | "normalized"
  | "enriched"
  | "duplicate_checked"
  | "completed";

export type SignalProcessingMetrics = {
  technologyCount: number;
  organizationCount: number;
  researcherCount: number;
  totalEntityCount: number;
  duplicateScore?: number;
};

export type SignalProcessingResult = {
  signal: SignalInput;
  entities: EntityExtractionResult;
  duplicate: DuplicateMatch;
  action: SignalProcessingAction;
  stage: SignalProcessingStage;
  reasons: string[];
  metrics: SignalProcessingMetrics;
};

export type SignalProcessingErrorCode =
  | "INVALID_NORMALIZED_ITEM"
  | "MISSING_TITLE"
  | "MISSING_CANONICAL_URL"
  | "NORMALIZATION_FAILED";

export class SignalProcessingError extends Error {
  code: SignalProcessingErrorCode;

  constructor(code: SignalProcessingErrorCode, message: string) {
    super(message);
    this.name = "SignalProcessingError";
    this.code = code;
  }
}
