ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
    ADD COLUMN "emailVerificationHash" TEXT,
    ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_emailVerificationHash_key" ON "User"("emailVerificationHash");
ALTER TABLE "PriceAlert" ADD COLUMN "emailEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Notification" ADD COLUMN "emailStatus" TEXT NOT NULL DEFAULT 'none',
    ADD COLUMN "emailPayload" JSONB,
    ADD COLUMN "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "emailNextAttemptAt" TIMESTAMP(3),
    ADD COLUMN "emailClaimedAt" TIMESTAMP(3),
    ADD COLUMN "emailSentAt" TIMESTAMP(3),
    ADD COLUMN "emailProviderId" TEXT;
CREATE INDEX "Notification_emailStatus_emailNextAttemptAt_idx"
    ON "Notification"("emailStatus", "emailNextAttemptAt");
