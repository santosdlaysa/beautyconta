import type { PlanPrice } from "../domain/billing/plan-offers";

/** Preços publicados em docs/01-produto-e-planos.md. Uma configuração explícita prevalece. */
const DEFAULT_PLAN_PRICES = "PREMIUM:MONTHLY:1490,PREMIUM:ANNUAL:14990";

export function parsePriceList(raw: string | undefined): PlanPrice[] {
  return (raw ?? DEFAULT_PLAN_PRICES)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const [plan, period, cents] = entry.split(":").map((part) => part.trim());
      const priceCents = Number(cents);
      if (
        (plan !== "PREMIUM" && plan !== "MASTER") ||
        (period !== "MONTHLY" && period !== "ANNUAL") ||
        !Number.isInteger(priceCents) || priceCents <= 0
      ) {
        console.warn(`[env] Entrada inválida em PLAN_PRICES: "${entry}"`);
        return [];
      }
      return [{ plan, billingPeriod: period, priceCents }];
    });
}
