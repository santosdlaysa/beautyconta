-- Pedido de exclusão de conta feito de fora do aplicativo, para quem não
-- consegue entrar. Apple e Google exigem este caminho público em todo
-- aplicativo que cria conta.

CREATE TYPE "AccountDeletionRequestStatus" AS ENUM ('pending', 'done', 'rejected');

CREATE TABLE "account_deletion_requests" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "note" TEXT,
    "status" "AccountDeletionRequestStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handled_at" TIMESTAMP(3),

    CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "account_deletion_requests_status_created_at_idx"
    ON "account_deletion_requests"("status", "created_at");
