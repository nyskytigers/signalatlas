export type RerankingStatus = "SUCCESS" | "FAILED" | "DISABLED" | "SKIPPED";

export type RerankCandidate = {
  id: string;
  text: string;
  originalRank: number;
  retrievalScore?: number;
};

export type RerankResult = {
  id: string;
  originalRank: number;
  rerankedRank: number;
  rerankScore: number;
};

export type RerankRequestOptions = {
  timeoutMs?: number;
  maxRetries?: number;
};

export interface RerankingProvider {
  readonly provider: string;
  readonly model: string;
  readonly version: string;
  readonly maxCandidates: number;
  readonly maxResults: number;

  rerank(
    input: {
      query: string;
      candidates: readonly RerankCandidate[];
      topN: number;
    },
    options?: RerankRequestOptions
  ): Promise<readonly RerankResult[]>;
}
