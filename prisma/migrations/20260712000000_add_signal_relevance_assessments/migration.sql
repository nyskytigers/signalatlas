CREATE TABLE "SignalRelevanceAssessment" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "assessmentType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "providerVersion" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "scoringVersion" TEXT NOT NULL,
    "dimensionsJson" JSONB NOT NULL,
    "domainsJson" JSONB NOT NULL,
    "technologiesJson" JSONB NOT NULL,
    "explanation" TEXT,
    "dimensionExplanationsJson" JSONB,
    "warningsJson" JSONB,
    "providerConfidence" DOUBLE PRECISION,
    "normalizedConfidence" DOUBLE PRECISION,
    "finalScore" INTEGER,
    "band" TEXT,
    "rawResponseJson" JSONB,
    "requestMetadataJson" JSONB,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalRelevanceAssessment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SignalRelevanceAssessment_signalId_createdAt_idx" ON "SignalRelevanceAssessment"("signalId", "createdAt");
CREATE INDEX "SignalRelevanceAssessment_provider_model_idx" ON "SignalRelevanceAssessment"("provider", "model");
CREATE INDEX "SignalRelevanceAssessment_status_idx" ON "SignalRelevanceAssessment"("status");

ALTER TABLE "SignalRelevanceAssessment" ADD CONSTRAINT "SignalRelevanceAssessment_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
