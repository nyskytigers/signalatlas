import {
  isSignalPersistenceEnabled,
  processAndPersistNormalizedItem,
  type NormalizedSignalItem,
  type ProcessAndPersistOptions,
  type SignalPersistenceResult,
} from "../signals";

export type IngestSignalPersistenceOutcome =
  | {
      attempted: false;
      status: "disabled";
    }
  | {
      attempted: true;
      status: SignalPersistenceResult["status"];
      result: SignalPersistenceResult;
    }
  | {
      attempted: true;
      status: "failed";
      error: string;
    };

export type IngestSignalPersistenceOptions = ProcessAndPersistOptions & {
  onFailure?: (error: unknown) => Promise<void>;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function maybePersistSignalForIngestItem(
  item: NormalizedSignalItem,
  options: IngestSignalPersistenceOptions = {}
): Promise<IngestSignalPersistenceOutcome> {
  if (!isSignalPersistenceEnabled(options.env)) {
    return {
      attempted: false,
      status: "disabled",
    };
  }

  try {
    const result = await processAndPersistNormalizedItem(item, options);
    return {
      attempted: true,
      status: result.status,
      result,
    };
  } catch (error) {
    await options.onFailure?.(error);

    return {
      attempted: true,
      status: "failed",
      error: getErrorMessage(error),
    };
  }
}
