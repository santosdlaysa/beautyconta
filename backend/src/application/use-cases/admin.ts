import { DomainError } from "../../domain/shared";
import { MAX_PRICE_CENTS, MIN_PRICE_CENTS, assertValidOffer } from "../../domain/billing/plan-offers";
import type { PlanOfferRecord } from "../ports/records";
import type { AdminMetricsRepository, PlanOfferRepository } from "../ports/repositories";

/**
 * Casos de uso do painel administrativo.
 *
 * Nenhum deles confere permissão: quem faz isso é a guarda na borda HTTP, uma
 * vez, para todas as rotas do painel. Repetir a verificação aqui daria a
 * impressão de duas camadas de proteção onde há uma — e a que importa é a que
 * não pode ser esquecida ao adicionar a próxima rota.
 */

export class ListPlanOffers {
  constructor(private readonly offers: PlanOfferRepository) {}

  execute(): Promise<PlanOfferRecord[]> {
    return this.offers.list();
  }
}

/**
 * Grava o preço de um plano.
 *
 * O valor chega em centavos inteiros e é validado no domínio antes de tocar o
 * banco: preço zerado publicaria uma assinatura de graça, e preço absurdo por
 * dedo escorregado no teclado numérico é o tipo de engano que só aparece
 * quando alguém tenta pagar.
 */
export class SavePlanOffer {
  constructor(private readonly offers: PlanOfferRepository) {}

  async execute(input: {
    plan: PlanOfferRecord["plan"];
    billingPeriod: PlanOfferRecord["billingPeriod"];
    priceCents: number;
    isActive?: boolean;
    benefits?: string[];
  }): Promise<PlanOfferRecord> {
    assertValidOffer({ priceCents: input.priceCents });

    const benefits = (input.benefits ?? [])
      .map((benefit) => benefit.trim())
      .filter(Boolean)
      .slice(0, 12);

    return this.offers.save({
      plan: input.plan,
      billingPeriod: input.billingPeriod,
      priceCents: input.priceCents,
      isActive: input.isActive ?? true,
      benefits,
    });
  }
}

export class DeletePlanOffer {
  constructor(private readonly offers: PlanOfferRepository) {}

  execute(
    plan: PlanOfferRecord["plan"],
    billingPeriod: PlanOfferRecord["billingPeriod"],
  ): Promise<void> {
    return this.offers.delete(plan, billingPeriod);
  }
}

/** Os números que o painel mostra na abertura. */
export class GetAdminOverview {
  constructor(private readonly metrics: AdminMetricsRepository) {}

  execute(now: Date) {
    return this.metrics.overview(now);
  }
}

export class ListAdminUsers {
  constructor(private readonly metrics: AdminMetricsRepository) {}

  execute(options: { search?: string; limit?: number; offset?: number }) {
    return this.metrics.listUsers({
      ...(options.search ? { search: options.search.trim() } : {}),
      // Teto para que um `limit` grande demais não vire uma varredura da tabela
      // inteira numa requisição.
      limit: Math.min(Math.max(options.limit ?? 50, 1), 200),
      offset: Math.max(options.offset ?? 0, 0),
    });
  }
}

export class GetAdminUser {
  constructor(private readonly metrics: AdminMetricsRepository) {}

  async execute(userId: string) {
    const user = await this.metrics.findUser(userId);
    if (!user) throw new DomainError("Usuária não encontrada.", "userId");
    return user;
  }
}

export class ListAdminSubscriptions {
  constructor(private readonly metrics: AdminMetricsRepository) {}

  execute(options: { limit?: number; offset?: number }) {
    return this.metrics.listSubscriptions({
      limit: Math.min(Math.max(options.limit ?? 50, 1), 200),
      offset: Math.max(options.offset ?? 0, 0),
    });
  }
}


/** Funil e receita do mês, contra o anterior. */
export class GetBusinessMetrics {
  constructor(private readonly metrics: AdminMetricsRepository) {}

  async execute(now: Date) {
    const [resumo, serie] = await Promise.all([
      this.metrics.businessMetrics(now),
      // Trinta dias: o bastante para ver tendência sem virar um borrão.
      this.metrics.signupSeries(now, 30),
    ]);

    return { ...resumo, signups: serie };
  }
}

export class ListAdminBusinesses {
  constructor(private readonly metrics: AdminMetricsRepository) {}

  execute(options: { search?: string; limit?: number; offset?: number }) {
    return this.metrics.listBusinesses({
      ...(options.search ? { search: options.search.trim() } : {}),
      limit: Math.min(Math.max(options.limit ?? 50, 1), 200),
      offset: Math.max(options.offset ?? 0, 0),
    });
  }
}

export class GetRecentActivity {
  constructor(private readonly metrics: AdminMetricsRepository) {}

  execute(limit = 40) {
    return this.metrics.recentActivity(Math.min(Math.max(limit, 1), 100));
  }
}

/**
 * Eventos de cobrança e o que eles revelam.
 *
 * A saúde vem junto da lista de propósito: o número de eventos não processados
 * só significa alguma coisa ao lado dos eventos em si.
 */
export class GetBillingLog {
  constructor(private readonly metrics: AdminMetricsRepository) {}

  async execute(now: Date, options: { onlyUnprocessed?: boolean } = {}) {
    const [events, health] = await Promise.all([
      this.metrics.listBillingEvents({
        limit: 100,
        ...(options.onlyUnprocessed ? { onlyUnprocessed: true } : {}),
      }),
      this.metrics.billingHealth(now),
    ]);

    return { events, health };
  }
}

export { MAX_PRICE_CENTS, MIN_PRICE_CENTS };
