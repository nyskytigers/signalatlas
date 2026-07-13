CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "SignalEmbedding" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "providerVersion" TEXT NOT NULL,
    "embeddingVersion" TEXT NOT NULL,
    "inputVersion" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "sourceTextHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadataJson" JSONB,
    "embedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SignalEmbedding_signalId_provider_model_embeddingVersion_key"
ON "SignalEmbedding"("signalId", "provider", "model", "embeddingVersion");

CREATE INDEX "SignalEmbedding_signalId_idx" ON "SignalEmbedding"("signalId");
CREATE INDEX "SignalEmbedding_provider_model_embeddingVersion_idx"
ON "SignalEmbedding"("provider", "model", "embeddingVersion");
CREATE INDEX "SignalEmbedding_status_idx" ON "SignalEmbedding"("status");

ALTER TABLE "SignalEmbedding"
ADD CONSTRAINT "SignalEmbedding_signalId_fkey"
FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
