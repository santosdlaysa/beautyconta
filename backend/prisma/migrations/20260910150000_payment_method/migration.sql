-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'TRANSFER', 'OTHER');

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "payment_method" "PaymentMethod";

