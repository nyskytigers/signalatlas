import { createNvidiaRerankingProvider } from "./providers/nvidia";
import { RerankingValidationError } from "./errors";
import { validateRerankCandidates, validateRerankResults, validateTopN } from "./validation";
import type { RerankCandidate, RerankRequestOptions, RerankingProvider } from "./types";

export async function rerankCandidates(args: {
  query: string;
  candidates: readonly RerankCandidate[];
  topN: number;
  provider?: RerankingProvider;
  options?: RerankRequestOptions;
}) {
  const provider = args.provider ?? createNvidiaRerankingProvider();
  const candidates = validateRerankCandidates(args.candidates, provider.maxCandidates);
  const topN = validateTopN(args.topN, candidates.length);
  const results = await provider.rerank(
    {
      query: args.query,
      candidates,
      topN,
    },
    args.options
  );
  const validatedResults = validateRerankResults(results, candidates, topN);
  if (validatedResults.length !== topN) {
    throw new RerankingValidationError("Reranking provider returned fewer results than requested.");
  }
  return validatedResults;
}
