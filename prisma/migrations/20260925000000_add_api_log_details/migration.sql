-- AlterTable
ALTER TABLE "ApiRequestLog" ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "ipHash" TEXT,
ADD COLUMN     "rpcMethod" TEXT,
ADD COLUMN     "src" TEXT,
ADD COLUMN     "toolName" TEXT;

-- CreateIndex
CREATE INDEX "ApiRequestLog_toolName_idx" ON "ApiRequestLog"("toolName");

-- CreateIndex
CREATE INDEX "ApiRequestLog_ipHash_idx" ON "ApiRequestLog"("ipHash");
