import { historyWindow } from "../../domain/billing/plan-limits";
import { NotFoundError } from "../errors";
import type { CalculationRepository } from "../ports/repositories";
import type { PricingCalculationRecord } from "../ports/records";
import type { BusinessAccess } from "../services/business-access";

/**
 * Histórico de cálculos.
 *
 * No plano gratuito a lista mostra os cinco últimos. O que passa disso continua
 * gravado e volta a aparecer quando a assinatura for feita: o item F-01 proíbe
 * apagar dado ao atingir limite.
 */
export class ListCalculations {
  constructor(
    private readonly access: BusinessAccess,
    private readonly calculations: CalculationRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    options: { serviceId?: string } = {},
  ): Promise<{
    items: PricingCalculationRecord[];
    total: number;
    limitedByPlan: boolean;
  }> {
    await this.access.authorize(userId, businessId);

    const plan = await this.access.currentPlan(businessId);
    const window = historyWindow(plan);

    const [items, total] = await Promise.all([
      this.calculations.list(businessId, { limit: window, ...options }),
      this.calculations.count(businessId),
    ]);

    return { items, total, limitedByPlan: window !== null && total > window };
  }
}

export class GetCalculation {
  constructor(
    private readonly access: BusinessAccess,
    private readonly calculations: CalculationRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    id: string,
  ): Promise<PricingCalculationRecord> {
    await this.access.authorize(userId, businessId);
    const calculation = await this.calculations.findById(businessId, id);
    if (!calculation) throw new NotFoundError("Cálculo");
    return calculation;
  }
}
