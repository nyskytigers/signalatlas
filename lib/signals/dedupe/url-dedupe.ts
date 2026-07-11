import { hashUrl, normalizeUrlForDedupe } from "./normalize";

export function getDedupeUrl(url: string) {
  return normalizeUrlForDedupe(url);
}

export function getUrlDedupeHash(url: string) {
  return hashUrl(url);
}

export function urlsMatchForDedupe(a: string, b: string) {
  const normalizedA = getDedupeUrl(a);
  const normalizedB = getDedupeUrl(b);

  return Boolean(normalizedA && normalizedB && normalizedA === normalizedB);
}
