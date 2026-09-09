-- CreateEnum
CREATE TYPE "Segment" AS ENUM ('nails', 'lashes', 'brows', 'hair', 'esthetics', 'makeup', 'waxing', 'other');

-- CreateEnum
CREATE TYPE "WorkModel" AS ENUM ('home', 'own_salon', 'rented_station', 'shared_space', 'mobile');

-- CreateEnum
CREATE TYPE "MeasurementUnit" AS ENUM ('unit', 'pair', 'box', 'g', 'kg', 'ml', 'l', 'm', 'cm', 'custom');

-- CreateEnum
CREATE TYPE "FixedCostAllocationMethod" AS ENUM ('PRODUCTIVE_HOUR', 'APPOINTMENT');

-- CreateEnum
CREATE TYPE "RoundingStrategy" AS ENUM ('NONE', 'NEAREST_1', 'NEAREST_5', 'NEAREST_10', 'ENDING_90');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PREMIUM', 'MASTER');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'in_grace', 'past_due', 'canceled', 'expired', 'refunded', 'paused');

-- CreateEnum
CREATE TYPE "SubscriptionChannel" AS ENUM ('WEB', 'ANDROID', 'IOS');

-- CreateEnum
CREATE TYPE "SubscriptionProvider" AS ENUM ('MERCADO_PAGO', 'REVENUECAT');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "name" TEXT,
    "primary_category" "Segment" NOT NULL,
    "work_model" "WorkModel" NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_settings" (
    "business_id" UUID NOT NULL,
    "desired_monthly_withdrawal_cents" BIGINT NOT NULL,
    "productive_hours_per_month" DECIMAL(8,2) NOT NULL,
    "estimated_appointments_per_month" INTEGER NOT NULL,
    "fixed_cost_allocation_method" "FixedCostAllocationMethod" NOT NULL DEFAULT 'PRODUCTIVE_HOUR',
    "rounding_strategy" "RoundingStrategy" NOT NULL DEFAULT 'NONE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_settings_pkey" PRIMARY KEY ("business_id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "purchase_price_cents" BIGINT NOT NULL,
    "purchase_quantity_decimal" DECIMAL(14,4) NOT NULL,
    "unit" "MeasurementUnit" NOT NULL,
    "waste_percentage_decimal" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "purchase_date" DATE,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_costs" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "monthly_amount_cents" BIGINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixed_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "desired_margin_decimal" DECIMAL(6,4) NOT NULL,
    "current_price_cents" BIGINT,
    "other_direct_cost_cents" BIGINT NOT NULL DEFAULT 0,
    "sales_fee_percentage_decimal" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_materials" (
    "service_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "quantity_used_decimal" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "service_materials_pkey" PRIMARY KEY ("service_id","material_id")
);

-- CreateTable
CREATE TABLE "pricing_calculations" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "service_id" UUID,
    "calculation_version" INTEGER NOT NULL,
    "input_snapshot" JSONB NOT NULL,
    "material_cost_cents" BIGINT NOT NULL,
    "labor_cost_cents" BIGINT NOT NULL,
    "allocated_fixed_cost_cents" BIGINT NOT NULL,
    "other_direct_cost_cents" BIGINT NOT NULL,
    "total_base_cost_cents" BIGINT NOT NULL,
    "minimum_price_cents" BIGINT NOT NULL,
    "suggested_price_cents" BIGINT NOT NULL,
    "commercial_price_cents" BIGINT NOT NULL,
    "expected_profit_cents" BIGINT NOT NULL,
    "expected_margin_decimal" DECIMAL(6,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "acquisition_price_cents" BIGINT NOT NULL,
    "residual_value_cents" BIGINT NOT NULL DEFAULT 0,
    "useful_life_months" INTEGER NOT NULL,
    "acquisition_date" DATE NOT NULL,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL,
    "channel" "SubscriptionChannel" NOT NULL,
    "provider" "SubscriptionProvider" NOT NULL,
    "billing_period" "BillingPeriod" NOT NULL,
    "provider_customer_id" TEXT,
    "provider_subscription_id" TEXT,
    "revenuecat_app_user_id" TEXT,
    "mp_preapproval_id" TEXT,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" UUID NOT NULL,
    "business_id" UUID,
    "subscription_id" UUID,
    "source" "SubscriptionProvider" NOT NULL,
    "external_event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "businesses_owner_user_id_idx" ON "businesses"("owner_user_id");

-- CreateIndex
CREATE INDEX "materials_business_id_is_archived_idx" ON "materials"("business_id", "is_archived");

-- CreateIndex
CREATE INDEX "fixed_costs_business_id_is_active_idx" ON "fixed_costs"("business_id", "is_active");

-- CreateIndex
CREATE INDEX "services_business_id_is_archived_idx" ON "services"("business_id", "is_archived");

-- CreateIndex
CREATE INDEX "service_materials_material_id_idx" ON "service_materials"("material_id");

-- CreateIndex
CREATE INDEX "pricing_calculations_business_id_created_at_idx" ON "pricing_calculations"("business_id", "created_at");

-- CreateIndex
CREATE INDEX "pricing_calculations_service_id_created_at_idx" ON "pricing_calculations"("service_id", "created_at");

-- CreateIndex
CREATE INDEX "equipment_business_id_is_archived_idx" ON "equipment"("business_id", "is_archived");

-- CreateIndex
CREATE INDEX "subscriptions_business_id_status_idx" ON "subscriptions"("business_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_revenuecat_app_user_id_idx" ON "subscriptions"("revenuecat_app_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_provider_provider_subscription_id_key" ON "subscriptions"("provider", "provider_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_events_external_event_id_key" ON "billing_events"("external_event_id");

-- CreateIndex
CREATE INDEX "billing_events_subscription_id_created_at_idx" ON "billing_events"("subscription_id", "created_at");

-- CreateIndex
CREATE INDEX "billing_events_processed_at_idx" ON "billing_events"("processed_at");

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_costs" ADD CONSTRAINT "fixed_costs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_materials" ADD CONSTRAINT "service_materials_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_materials" ADD CONSTRAINT "service_materials_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_calculations" ADD CONSTRAINT "pricing_calculations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_calculations" ADD CONSTRAINT "pricing_calculations_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
