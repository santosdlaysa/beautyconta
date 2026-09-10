import type { Request, Response } from "express";
import type { Dependencies } from "../../../application/ports/dependencies";
import { GetCurrentOffers } from "../../../application/use-cases/plan-offers";
import { PLAN_LIMITS } from "../../../domain/billing/plan-limits";

/**
 * Catálogo de planos, público.
 *
 * Público porque a tela de preços precisa existir antes da conta — e porque as
 * lojas exigem que o valor apareça antes da compra, inclusive para quem só está
 * olhando.
 *
 * Os limites saem na resposta junto com os preços de propósito: é a mesma
 * tabela que o servidor aplica ao recusar um cadastro, então a tela nunca
 * promete um teto diferente do que a API vai impor.
 */
export class PlanController {
  constructor(private readonly deps: Dependencies) {}

  list = async (_req: Request, res: Response): Promise<void> => {
    const { plans } = this.deps;

    const offers = await new GetCurrentOffers(this.deps.planOffers, plans.prices).execute();

    res.json({
      /**
       * Vazio quando não há preço configurado. A tela usa isto para decidir se
       * mostra o botão de compra — sem preço, não mostra.
       */
      offers: offers.map((offer) => ({
        plan: offer.plan,
        billingPeriod: offer.billingPeriod,
        priceCents: offer.priceCents,
        monthlyEquivalentCents: offer.monthlyEquivalentCents,
        savingsPercent: offer.savingsPercent,
        benefits: offer.benefits,
      })),
      limits: PLAN_LIMITS,
      legal: {
        termsUrl: plans.termsUrl,
        privacyUrl: plans.privacyUrl,
        supportEmail: plans.supportEmail,
      },
    });
  };
}
