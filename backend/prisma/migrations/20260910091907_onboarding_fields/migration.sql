-- Dois campos que o onboarding já coletava e não tinham onde morar: ficavam só
-- no aparelho e sumiam quando a profissional trocava de celular.

-- Outros segmentos atendidos além do principal. Não entra em fórmula nenhuma:
-- serve para priorizar catálogo e conteúdo.
ALTER TABLE "businesses" ADD COLUMN "secondary_categories" "Segment"[] DEFAULT ARRAY[]::"Segment"[];

-- Quanto ela quer que sobre no mês, além da própria retirada. Nulo é diferente
-- de zero: zero seria uma meta declarada.
ALTER TABLE "business_settings" ADD COLUMN "monthly_profit_goal_cents" BIGINT;
