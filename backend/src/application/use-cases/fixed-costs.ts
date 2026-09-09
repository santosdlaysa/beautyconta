import { limitFor, PlanLimitError } from "../../domain/billing/plan-limits";
import { isSystemManagedFixedCost } from "../../domain/catalog/catalogs";
import { DomainError } from "../../domain/shared";
import { NotFoundError } from "../errors";
import type { FixedCostRepository } from "../ports/repositories";
import type { FixedCostRecord } from "../ports/records";
import type { BusinessAccess } from "../services/business-access";

export type FixedCostInput = {
  name: string;
  category: string;
  monthlyAmountCents: number;
  isActive?: boolean;
};

/** Item E-02. A soma dos ativos é o `CF` mensal das fórmulas do documento 03. */
export class RegisterFixedCost {
  constructor(
    private readonly access: BusinessAccess,
    private readonly fixedCosts: FixedCostRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    input: FixedCostInput,
  ): Promise<FixedCostRecord> {
    await this.access.authorize(userId, businessId);
    assertNotSystemManaged(input.category);

    const plan = await this.access.currentPlan(businessId);
    const limit = limitFor(plan, "fixedCosts");

    const created = await this.fixedCosts.createWithinLimit(
      {
        businessId,
        name: input.name.trim(),
        category: input.category,
        monthlyAmountCents: input.monthlyAmountCents,
        isActive: input.isActive ?? true,
      },
      limit,
    );

    if (!created) throw new PlanLimitError("fixedCosts", limit as number, plan);
    return created;
  }
}

export class ListFixedCosts {
  constructor(
    private readonly access: BusinessAccess,
    private readonly fixedCosts: FixedCostRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    options: { includeInactive?: boolean } = {},
  ): Promise<{ items: FixedCostRecord[]; monthlyTotalCents: number }> {
    await this.access.authorize(userId, businessId);
    const [items, monthlyTotalCents] = await Promise.all([
      this.fixedCosts.list(businessId, options),
      this.fixedCosts.monthlyTotalCents(businessId),
    ]);
    return { items, monthlyTotalCents };
  }
}

export class GetFixedCost {
  constructor(
    private readonly access: BusinessAccess,
    private readonly fixedCosts: FixedCostRepository,
  ) {}

  async execute(userId: string, businessId: string, id: string): Promise<FixedCostRecord> {
    await this.access.authorize(userId, businessId);
    const fixedCost = await this.fixedCosts.findById(businessId, id);
    if (!fixedCost) throw new NotFoundError("Custo fixo");
    return fixedCost;
  }
}

export class UpdateFixedCost {
  constructor(
    private readonly access: BusinessAccess,
    private readonly fixedCosts: FixedCostRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    id: string,
    input: Partial<FixedCostInput>,
  ): Promise<FixedCostRecord> {
    const current = await new GetFixedCost(this.access, this.fixedCosts).execute(
      userId,
      businessId,
      id,
    );
    // A linha de reserva é gerada pelo sistema; nem entra, nem é editada à mão.
    assertNotSystemManaged(current.category);
    if (input.category !== undefined) assertNotSystemManaged(input.category);

    return this.fixedCosts.update(businessId, id, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.monthlyAmountCents !== undefined
        ? { monthlyAmountCents: input.monthlyAmountCents }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    });
  }
}

export class DeleteFixedCost {
  constructor(
    private readonly access: BusinessAccess,
    private readonly fixedCosts: FixedCostRepository,
  ) {}

  async execute(userId: string, businessId: string, id: string): Promise<void> {
    await new GetFixedCost(this.access, this.fixedCosts).execute(userId, businessId, id);
    await this.fixedCosts.delete(businessId, id);
  }
}

/**
 * A reserva para equipamentos é calculada a partir do cadastro do documento 07.
 * Aceitar lançamento manual criaria contagem dupla do mesmo custo.
 */
function assertNotSystemManaged(category: string): void {
  if (isSystemManagedFixedCost(category)) {
    throw new DomainError(
      "A reserva para equipamentos é calculada pelo sistema a partir dos equipamentos cadastrados.",
      "category",
    );
  }
}
