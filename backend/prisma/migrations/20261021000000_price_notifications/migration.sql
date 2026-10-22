ALTER TABLE "Favorite" ADD COLUMN "saleNotified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PriceAlert" ADD COLUMN "notified" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "PriceAlert_userId_gameId_key" ON "PriceAlert"("userId", "gameId");

CREATE TABLE "Notification" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "itadGameId" TEXT NOT NULL,
  "gameTitle" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "storeName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
