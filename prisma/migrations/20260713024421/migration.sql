-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "canonicalUrl" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceName" TEXT,
    "publishedAt" TIMESTAMP(3),
    "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "organizations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "researchers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relevanceScore" DOUBLE PRECISION,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Signal_canonicalUrl_key" ON "Signal"("canonicalUrl");

-- CreateIndex
CREATE INDEX "Signal_signalType_idx" ON "Signal"("signalType");

-- CreateIndex
CREATE INDEX "Signal_publishedAt_idx" ON "Signal"("publishedAt");

-- CreateIndex
CREATE INDEX "Signal_keywords_idx" ON "Signal"("keywords");
