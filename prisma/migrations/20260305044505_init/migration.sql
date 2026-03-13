-- CreateEnum
CREATE TYPE "LabDomain" AS ENUM ('MARINE', 'XR', 'BOTH');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('WEBSITE', 'RSS', 'ARXIV', 'GOOGLE_SCHOLAR', 'GITHUB', 'YOUTUBE', 'X', 'LINKEDIN', 'BLUESKY', 'OTHER');

-- CreateEnum
CREATE TYPE "IngestStatus" AS ENUM ('NEW', 'FETCHED', 'PARSED', 'FAILED', 'IGNORED');

-- CreateTable
CREATE TABLE "Lab" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "org" TEXT,
    "country" TEXT,
    "domain" "LabDomain" NOT NULL DEFAULT 'BOTH',
    "homepageUrl" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "name" TEXT,
    "url" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "lastOkAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "sourceId" TEXT,
    "url" TEXT NOT NULL,
    "externalId" TEXT,
    "checksum" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "contentText" TEXT,
    "publishedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3),
    "status" "IngestStatus" NOT NULL DEFAULT 'NEW',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "novelty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lab_slug_key" ON "Lab"("slug");

-- CreateIndex
CREATE INDEX "Lab_domain_idx" ON "Lab"("domain");

-- CreateIndex
CREATE INDEX "Lab_isActive_idx" ON "Lab"("isActive");

-- CreateIndex
CREATE INDEX "Source_labId_idx" ON "Source"("labId");

-- CreateIndex
CREATE INDEX "Source_type_idx" ON "Source"("type");

-- CreateIndex
CREATE INDEX "Source_isActive_idx" ON "Source"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Source_labId_url_key" ON "Source"("labId", "url");

-- CreateIndex
CREATE INDEX "Item_labId_publishedAt_idx" ON "Item"("labId", "publishedAt");

-- CreateIndex
CREATE INDEX "Item_score_idx" ON "Item"("score");

-- CreateIndex
CREATE INDEX "Item_status_idx" ON "Item"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Item_sourceId_externalId_key" ON "Item"("sourceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Item_url_key" ON "Item"("url");

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
