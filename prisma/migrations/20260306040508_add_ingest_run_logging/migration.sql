-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "authors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "rawJson" JSONB,
ADD COLUMN     "sourceName" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Item_tags_idx" ON "Item"("tags");
