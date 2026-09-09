import { effectivePlan } from "../../domain/billing/subscription-access";
import type { PlanSlug } from "../../domain/billing/plan-limits";
import { ForbiddenError, NotFoundError } from "../errors";
import type { BusinessRepository, SubscriptionRepository } from "../ports/repositories";
import type { BusinessRecord } from "../ports/records";

/**
 * Guarda de acesso ao negócio.
 *
 * Todo caso de uso que toca dado de negócio passa por aqui primeiro. É a
 * implementação do item B-03: nenhuma consulta parte de um `businessId` que não
 * tenha sido conferido contra a usuária autenticada.
 */
export class BusinessAccess {
  constructor(
    private readonly businesses: BusinessRepository,
    private readonly subscriptions: SubscriptionRepository,
  ) {}

  /** Devolve o negócio quando ele pertence à usuária; recusa em qualquer outro caso. */
  async authorize(userId: string, businessId: string): Promise<BusinessRecord> {
    const business = await this.businesses.findById(businessId);

    // Negócio inexistente e negócio alheio recebem a mesma resposta, para não
    // revelar a existência do registro de outra pessoa.
    if (!business || business.ownerUserId !== userId) {
      throw new ForbiddenError();
    }

    return business;
  }

  /** Plano em vigor, lido de `subscriptions`, que é a fonte de verdade. */
  async currentPlan(businessId: string): Promise<PlanSlug> {
    const subscriptions = await this.subscriptions.listByBusiness(businessId);
    return effectivePlan(subscriptions);
  }

  /** Uso interno de webhooks, onde não há usuária na requisição. */
  async requireBusiness(businessId: string): Promise<BusinessRecord> {
    const business = await this.businesses.findById(businessId);
    if (!business) throw new NotFoundError("Negócio");
    return business;
  }
}
