-- AlterTable
ALTER TABLE "ForumTopic" ADD COLUMN "utilitySlug" TEXT;
ALTER TABLE "ForumTopic" ADD COLUMN "projectSlug" TEXT;

-- CreateIndex
CREATE INDEX "ForumTopic_utilitySlug_idx" ON "ForumTopic"("utilitySlug");
CREATE INDEX "ForumTopic_projectSlug_idx" ON "ForumTopic"("projectSlug");
