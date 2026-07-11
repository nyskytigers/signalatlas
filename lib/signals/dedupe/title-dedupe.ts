import { normalizeTitleForDedupe } from "./normalize";

function titleTokens(title: string) {
  return new Set(
    normalizeTitleForDedupe(title)
      .split(" ")
      .filter((token) => token.length > 1)
  );
}

export function calculateTitleSimilarity(a: string, b: string): number {
  const normalizedA = normalizeTitleForDedupe(a);
  const normalizedB = normalizeTitleForDedupe(b);

  if (!normalizedA || !normalizedB) return 0;
  if (normalizedA === normalizedB) return 1;

  const tokensA = titleTokens(normalizedA);
  const tokensB = titleTokens(normalizedB);

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function titlesMatchExactlyForDedupe(a: string, b: string) {
  const normalizedA = normalizeTitleForDedupe(a);
  const normalizedB = normalizeTitleForDedupe(b);

  return Boolean(normalizedA && normalizedB && normalizedA === normalizedB);
}
