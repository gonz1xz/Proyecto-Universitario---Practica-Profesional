ALTER TABLE "Store" ADD COLUMN "name" TEXT;

CREATE INDEX "PriceRecord_gameId_storeId_recordedAt_idx"
ON "PriceRecord"("gameId", "storeId", "recordedAt");
