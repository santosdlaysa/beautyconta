import { DomainError } from "../shared/domain-error";
import type { PlanSlug } from "./plan-limits";

/**
 * Ofertas de assinatura: o que a tela precisa mostrar antes do botão de compra.
 *
 * O preço mora aqui, e não no aplicativo, por uma razão prática: preço muda, e
 * aplicativo publicado não muda junto. Um número escrito na tela continuaria
 * errado no aparelho de quem não atualizou, e a loja mostra um valor enquanto o
 * aplicativo mostra outro.
 *
 * **Ressalva que vale para iOS e Android:** quando a compra é feita pela loja,
 * quem manda no preço é a loja, não este catálogo. O valor daqui serve para a
 * venda pela web e como reserva; na loja, a tela precisa mostrar o preço
 * localizado que o SDK devolve, porque ele varia por país e moeda e é o que
 * será cobrado de verdade.
 */

export type BillingPeriodSlug = "MONTHLY" | "ANNUAL";

export type PlanPrice = {
  plan: PlanSlug;
  billingPeriod: BillingPeriodSlug;
  priceCents: number;
};

export type PlanOffer = PlanPrice & {
  /**
   * Quanto sai por mês. Na anual é o número que a pessoa usa para comparar, e
   * calcular de cabeça um preço anual dividido por doze não é razoável pedir.
   */
  monthlyEquivalentCents: number;
  /**
   * Quanto a anual economiza contra doze mensalidades, em pontos percentuais.
   * `null` quando não há mensal para comparar, ou quando não há economia.
   */
  savingsPercent: number | null;
};

/**
 * Faixa aceita para o preço de uma oferta.
 *
 * O piso existe porque preço zerado publicaria assinatura de graça sem que
 * ninguém notasse. O teto pega o dedo escorregado no teclado numérico — um zero
 * a mais em R$ 29,90 vira R$ 299,00, e o engano só apareceria quando alguém
 * tentasse pagar.
 */
export const MIN_PRICE_CENTS = 100;
export const MAX_PRICE_CENTS = 100_000;

export function assertValidOffer(input: { priceCents: number }): void {
  if (!Number.isInteger(input.priceCents)) {
    throw new DomainError("O preço precisa ser um valor em centavos inteiros.", "priceCents");
  }
  if (input.priceCents < MIN_PRICE_CENTS || input.priceCents > MAX_PRICE_CENTS) {
    throw new DomainError(
      `O preço precisa estar entre ${formatCents(MIN_PRICE_CENTS)} e ${formatCents(MAX_PRICE_CENTS)}.`,
      "priceCents",
    );
  }
}

/** Só para a mensagem de erro: o resto do sistema não formata dinheiro aqui. */
function formatCents(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

const MONTHS_IN_YEAR = 12;

/**
 * Ofertas prontas para a tela, ordenadas da mais barata por mês para a mais
 * cara — que é a ordem em que a pessoa compara.
 *
 * Lista vazia quando não há preço configurado, e isso é proposital: sem preço
 * a tela não pode mostrar botão de compra. Apple e Google recusam a submissão
 * quando o valor não aparece antes da compra, e um botão que leva ao checkout
 * sem dizer quanto custa é, antes disso, uma armadilha para quem toca nele.
 */
export function buildOffers(prices: readonly PlanPrice[]): PlanOffer[] {
  return prices
    .filter((price) => price.priceCents > 0)
    .map((price) => describeOffer(price, prices))
    .sort((a, b) => a.monthlyEquivalentCents - b.monthlyEquivalentCents);
}

function describeOffer(price: PlanPrice, all: readonly PlanPrice[]): PlanOffer {
  const meses = price.billingPeriod === "ANNUAL" ? MONTHS_IN_YEAR : 1;

  return {
    ...price,
    monthlyEquivalentCents: Math.round(price.priceCents / meses),
    savingsPercent: savingsAgainstMonthly(price, all),
  };
}

/**
 * Desconto da anual contra doze mensalidades do mesmo plano.
 *
 * Arredonda para baixo de propósito: anunciar "economize 20%" quando a conta dá
 * 19,7% é promessa que a soma não sustenta.
 */
function savingsAgainstMonthly(price: PlanPrice, all: readonly PlanPrice[]): number | null {
  if (price.billingPeriod !== "ANNUAL") return null;

  const mensal = all.find(
    (item) => item.plan === price.plan && item.billingPeriod === "MONTHLY" && item.priceCents > 0,
  );
  if (!mensal) return null;

  const doze = mensal.priceCents * MONTHS_IN_YEAR;
  if (price.priceCents >= doze) return null;

  return Math.floor(((doze - price.priceCents) / doze) * 100);
}

/**
 * O que a assinatura entrega, na ordem em que a tela lista.
 *
 * Cada linha precisa ser verificável no produto: prometer o que o plano não faz
 * é o tipo de texto que a loja recusa e que a assinante cobra depois.
 */
export const PLAN_BENEFITS: Record<Exclude<PlanSlug, "FREE">, readonly string[]> = {
  PREMIUM: [
    "Serviços, materiais e custos fixos sem limite",
    "Histórico completo dos seus cálculos",
    "Equipamentos com reserva para reposição",
    "Agenda pública para receber marcações por link",
  ],
  MASTER: [
    "Tudo do Premium",
    "Até 5 negócios na mesma conta",
  ],
};
