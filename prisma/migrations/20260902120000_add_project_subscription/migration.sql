-- CreateTable
CREATE TABLE "ProjectSubscription" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmToken" TEXT NOT NULL,
    "unsubscribeToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "lastNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSubscription_confirmToken_key" ON "ProjectSubscription"("confirmToken");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSubscription_unsubscribeToken_key" ON "ProjectSubscription"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "ProjectSubscription_projectId_idx" ON "ProjectSubscription"("projectId");

-- CreateIndex
CREATE INDEX "ProjectSubscription_confirmed_idx" ON "ProjectSubscription"("confirmed");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSubscription_projectId_email_key" ON "ProjectSubscription"("projectId", "email");

-- AddForeignKey
ALTER TABLE "ProjectSubscription" ADD CONSTRAINT "ProjectSubscription_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
