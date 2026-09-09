-- O endereço da agenda pública deixa de ser código secreto e passa a ser um
-- apelido escolhido: /agendar/studio-marina.
--
-- Decisão de produto, com o custo à vista: o endereço fica adivinhável, e a
-- agenda passa a se defender pelo teto de requisição, pela antecedência mínima
-- e pelo horizonte de datas — não mais pelo sigilo do link.

ALTER TABLE "businesses" RENAME COLUMN "booking_token" TO "booking_slug";
ALTER INDEX "businesses_booking_token_key" RENAME TO "businesses_booking_slug_key";
