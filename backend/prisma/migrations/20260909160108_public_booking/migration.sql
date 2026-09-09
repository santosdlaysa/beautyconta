-- Agenda pública: link secreto, expediente e origem do atendimento.

-- O endereço secreto da agenda. Nulo enquanto a profissional não abrir a
-- agenda para clientes; único porque é ele que identifica o negócio na página.
ALTER TABLE "businesses" ADD COLUMN "booking_token" TEXT;
CREATE UNIQUE INDEX "businesses_booking_token_key" ON "businesses"("booking_token");

-- Origem do atendimento: a profissional precisa distinguir o que ela marcou do
-- que entrou sozinho pelo link.
CREATE TYPE "AppointmentSource" AS ENUM ('MANUAL', 'ONLINE');

ALTER TABLE "appointments" ADD COLUMN "client_phone" TEXT;
ALTER TABLE "appointments" ADD COLUMN "source" "AppointmentSource" NOT NULL DEFAULT 'MANUAL';

-- Expediente, em minutos desde a meia-noite no fuso do negócio. Um dia pode ter
-- mais de uma faixa: manhã e tarde, com almoço no meio.
CREATE TABLE "business_hours" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_hours_business_id_weekday_start_minute_key"
  ON "business_hours"("business_id", "weekday", "start_minute");
CREATE INDEX "business_hours_business_id_weekday_idx"
  ON "business_hours"("business_id", "weekday");

ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
