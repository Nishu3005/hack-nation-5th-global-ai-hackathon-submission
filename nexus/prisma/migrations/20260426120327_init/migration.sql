-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('FLASH', 'BASIC', 'DEEP', 'RESEARCH', 'EXTRACT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('SEARCH', 'RESEARCH', 'ANALYSIS', 'SYNTHESIS', 'CUSTOM');

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "paymentHash" TEXT NOT NULL,
    "preimage" TEXT,
    "amountSats" INTEGER NOT NULL,
    "tier" "Tier" NOT NULL,
    "queryHash" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "invoiceBolt11" TEXT NOT NULL,
    "macaroon" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "agentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "capabilities" TEXT[],
    "endpoint" TEXT NOT NULL,
    "stakeAmountSats" INTEGER NOT NULL DEFAULT 0,
    "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgResponseMs" INTEGER NOT NULL DEFAULT 0,
    "disputeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTasksDone" INTEGER NOT NULL DEFAULT 0,
    "lightningAddress" TEXT,
    "pubkey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "result" TEXT,
    "errorMsg" TEXT,
    "stakeAmountSats" INTEGER NOT NULL DEFAULT 0,
    "bountyAmountSats" INTEGER NOT NULL DEFAULT 0,
    "hireeId" TEXT NOT NULL,
    "hirerId" TEXT,
    "escrowPaid" BOOLEAN NOT NULL DEFAULT false,
    "escrowReleased" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchCache" (
    "id" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "tier" "Tier" NOT NULL,
    "query" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceIdempotency" (
    "id" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "tier" "Tier" NOT NULL,
    "bolt11" TEXT NOT NULL,
    "paymentHash" TEXT NOT NULL,
    "macaroon" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentHash_key" ON "Payment"("paymentHash");

-- CreateIndex
CREATE INDEX "Payment_paymentHash_idx" ON "Payment"("paymentHash");

-- CreateIndex
CREATE INDEX "Payment_queryHash_idx" ON "Payment"("queryHash");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_agentId_idx" ON "Payment"("agentId");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Agent_reputationScore_idx" ON "Agent"("reputationScore");

-- CreateIndex
CREATE INDEX "Agent_isActive_idx" ON "Agent"("isActive");

-- CreateIndex
CREATE INDEX "Task_hireeId_idx" ON "Task"("hireeId");

-- CreateIndex
CREATE INDEX "Task_hirerId_idx" ON "Task"("hirerId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_createdAt_idx" ON "Task"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SearchCache_queryHash_key" ON "SearchCache"("queryHash");

-- CreateIndex
CREATE INDEX "SearchCache_queryHash_idx" ON "SearchCache"("queryHash");

-- CreateIndex
CREATE INDEX "SearchCache_expiresAt_idx" ON "SearchCache"("expiresAt");

-- CreateIndex
CREATE INDEX "SearchCache_tier_idx" ON "SearchCache"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceIdempotency_paymentHash_key" ON "InvoiceIdempotency"("paymentHash");

-- CreateIndex
CREATE INDEX "InvoiceIdempotency_queryHash_tier_idx" ON "InvoiceIdempotency"("queryHash", "tier");

-- CreateIndex
CREATE INDEX "InvoiceIdempotency_paymentHash_idx" ON "InvoiceIdempotency"("paymentHash");

-- CreateIndex
CREATE INDEX "InvoiceIdempotency_expiresAt_idx" ON "InvoiceIdempotency"("expiresAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_hireeId_fkey" FOREIGN KEY ("hireeId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_hirerId_fkey" FOREIGN KEY ("hirerId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
