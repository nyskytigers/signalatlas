export {
  hashUrl,
  normalizeIdentifier,
  normalizeTitleForDedupe,
  normalizeUrlForDedupe,
} from "./normalize";
export { getSignalIdentifiers, shareIdentifier } from "./identifier-dedupe";
export { getDedupeUrl, getUrlDedupeHash, urlsMatchForDedupe } from "./url-dedupe";
export {
  calculateTitleSimilarity,
  titlesMatchExactlyForDedupe,
} from "./title-dedupe";
export {
  findDuplicateSignal,
  type DuplicateMatch,
  type MinimalExistingSignal,
} from "./duplicate-engine";
