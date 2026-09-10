import { PLAN_BENEFITS, buildOffers, type PlanOffer, type PlanPrice } from "../../domain/billing/plan-offers";
import type { PlanOfferRepository } from "../ports/repositories";

/** Uma oferta pronta para a tela: preço calculado e benefícios resolvidos. */
export type CurrentOffer = PlanOffer & { benefits: readonly string[] };

/**
 * Os preços que valem agora.
 *
 * O banco é a fonte, porque é o painel que edita. A configuração do ambiente
 * entra só como semente: um servidor recém-instalado, com `PLAN_PRICES` no
 * ambiente e nenhuma linha na tabela, continua vendendo — e a primeira edição
 * pelo painel passa a mandar, para sempre.
 *
 * Consultado a cada pedido, e não uma vez na inicialização: preço lido só na
 * subida continuaria valendo até alguém reiniciar o servidor, e o painel
 * pareceria não ter salvado nada.
 */
export class GetCurrentOffers {
  constructor(
    private readonly offers: PlanOfferRepository,
    /** Semente do ambiente, usada apenas enquanto a tabela estiver vazia. */
    private readonly seed: readonly PlanPrice[],
  ) {}

  async execute(): Promise<CurrentOffer[]> {
    /**
     * A tabela inteira, e não só as ativas.
     *
     * A distinção importa: **tabela vazia** significa "ainda não configurei", e
     * a semente do ambiente entra. **Todas desligadas** significa "não quero
     * vender agora" — e voltar para a semente aí republicaria um preço que
     * alguém desligou de propósito.
     */
    const todas = await this.offers.list();

    if (todas.length === 0) {
      return buildOffers(this.seed).map((offer) => ({ ...offer, benefits: benefitsOf(offer.plan) }));
    }

    const salvas = todas.filter((offer) => offer.isActive);

    const editados = new Map(
      salvas.map((offer) => [`${offer.plan}:${offer.billingPeriod}`, offer.benefits]),
    );

    return buildOffers(
      salvas.map((offer) => ({
        plan: offer.plan,
        billingPeriod: offer.billingPeriod,
        priceCents: offer.priceCents,
      })),
    ).map((offer) => {
      const doPainel = editados.get(`${offer.plan}:${offer.billingPeriod}`) ?? [];

      return {
        ...offer,
        // Lista vazia no painel não é "sem benefícios": é "ainda não editei".
        // Mostrar nada aí deixaria a tela de venda sem argumento nenhum.
        benefits: doPainel.length > 0 ? doPainel : benefitsOf(offer.plan),
      };
    });
  }
}

function benefitsOf(plan: PlanOffer["plan"]): readonly string[] {
  return PLAN_BENEFITS[plan as keyof typeof PLAN_BENEFITS] ?? [];
}
