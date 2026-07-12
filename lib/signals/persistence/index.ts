export { loadDuplicateCandidates } from "./load-duplicate-candidates";
export { mergeSignalForUpdate } from "./merge-signal";
export {
  isSignalPersistenceEnabled,
  processAndPersistNormalizedItem,
} from "./process-and-persist";
export type {
  PersistedSignalSummary,
  ProcessAndPersistOptions,
  SignalDatabaseClient,
  SignalDuplicateCandidate,
  SignalForUpdate,
  SignalPersistenceOperation,
  SignalPersistenceResult,
  SignalPersistenceStatus,
} from "./types";
