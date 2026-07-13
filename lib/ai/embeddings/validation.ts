import { EmbeddingValidationError } from "./errors";
import type { EmbeddingResult } from "./types";

export function validateEmbeddingVector(vector: unknown, dimensions: number) {
  if (!Array.isArray(vector)) throw new EmbeddingValidationError("Embedding vector must be an array.");
  if (vector.length === 0) throw new EmbeddingValidationError("Embedding vector must not be empty.");
  if (vector.length !== dimensions) {
    throw new EmbeddingValidationError(`Embedding vector dimension mismatch: expected ${dimensions}, received ${vector.length}.`);
  }

  return vector.map((value, index) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new EmbeddingValidationError(`Embedding vector value at index ${index} must be finite.`);
    }
    return value;
  });
}

export function validateEmbeddingResults(
  results: readonly EmbeddingResult[],
  inputCount: number,
  dimensions: number
) {
  if (results.length !== inputCount) {
    throw new EmbeddingValidationError(
      `Embedding result count mismatch: expected ${inputCount}, received ${results.length}.`
    );
  }

  return results
    .map((result) => ({
      index: result.index,
      embedding: validateEmbeddingVector(result.embedding, dimensions),
    }))
    .sort((a, b) => a.index - b.index);
}
