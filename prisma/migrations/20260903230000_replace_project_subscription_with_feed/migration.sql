-- DropTable
-- ProjectSubscription had zero confirmed real subscribers over its whole
-- life (verified live before this migration) — safe to drop outright, no
-- data migration needed.
DROP TABLE "ProjectSubscription";

-- CreateTable
CREATE TABLE "FeedSubscription" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "state" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmToken" TEXT NOT NULL,
    "unsubscribeToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "lastNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "FeedSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedSubscription_confirmToken_key" ON "FeedSubscription"("confirmToken");

-- CreateIndex
CREATE UNIQUE INDEX "FeedSubscription_unsubscribeToken_key" ON "FeedSubscription"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "FeedSubscription_state_idx" ON "FeedSubscription"("state");

-- CreateIndex
CREATE INDEX "FeedSubscription_confirmed_idx" ON "FeedSubscription"("confirmed");

-- CreateIndex
CREATE UNIQUE INDEX "FeedSubscription_email_state_key" ON "FeedSubscription"("email", "state");
