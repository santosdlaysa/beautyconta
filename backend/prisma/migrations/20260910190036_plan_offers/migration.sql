-- AlterTable
ALTER TABLE "businesses" ALTER COLUMN "secondary_categories" DROP DEFAULT;

-- CreateTable
CREATE TABLE "plan_offers" (
    "id" UUID NOT NULL,
    "plan" "Plan" NOT NULL,
    "billing_period" "BillingPeriod" NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "benefits" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_offers_plan_billing_period_key" ON "plan_offers"("plan", "billing_period");
