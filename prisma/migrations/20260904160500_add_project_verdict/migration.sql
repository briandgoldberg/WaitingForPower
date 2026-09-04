-- CreateTable
CREATE TABLE "ProjectVerdict" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "voterKey" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectVerdict_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectVerdict_projectId_voterKey_key" ON "ProjectVerdict"("projectId", "voterKey");
CREATE INDEX "ProjectVerdict_projectId_idx" ON "ProjectVerdict"("projectId");

ALTER TABLE "ProjectVerdict" ADD CONSTRAINT "ProjectVerdict_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
