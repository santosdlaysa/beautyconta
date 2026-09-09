import { limitFor, PlanLimitError } from "../../domain/billing/plan-limits";
import type { UnitSlug } from "../../domain/catalog/catalogs";
import { convertQuantity } from "../../domain/catalog/units";
import { DomainError } from "../../domain/shared";
import { ConflictError, NotFoundError } from "../errors";
import type {
  CalculationRepository,
  MaterialRepository,
  ServiceRepository,
} from "../ports/repositories";
import type { ServiceRecord } from "../ports/records";
import type { BusinessAccess } from "../services/business-access";

export type ServiceMaterialInput = {
  materialId: string;
  quantityUsed: number;
  /** Quando informada, a quantidade é convertida para a unidade da compra. */
  unit?: UnitSlug;
};

export type ServiceInputData = {
  name: string;
  category: string;
  durationMinutes: number;
  /** Fração entre 0 e 1. */
  desiredMargin: number;
  currentPriceCents?: number | null;
  otherDirectCostCents?: number;
  /** Fração entre 0 e 1. */
  salesFeePercentage?: number;
  materials?: ServiceMaterialInput[];
};

/** Item E-04: serviço com composição de materiais e preço atual opcional. */
export class CreateService {
  constructor(
    private readonly access: BusinessAccess,
    private readonly services: ServiceRepository,
    private readonly materials: MaterialRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    input: ServiceInputData,
  ): Promise<ServiceRecord> {
    await this.access.authorize(userId, businessId);

    const plan = await this.access.currentPlan(businessId);
    const limit = limitFor(plan, "services");
    const materials = await resolveMaterials(this.materials, businessId, input.materials ?? []);

    const created = await this.services.createWithinLimit(
      {
        businessId,
        name: input.name.trim(),
        category: input.category,
        durationMinutes: input.durationMinutes,
        desiredMargin: input.desiredMargin,
        currentPriceCents: input.currentPriceCents ?? null,
        otherDirectCostCents: input.otherDirectCostCents ?? 0,
        salesFeePercentage: input.salesFeePercentage ?? 0,
        isArchived: false,
        materials,
      },
      limit,
    );

    if (!created) throw new PlanLimitError("services", limit as number, plan);
    return created;
  }
}

export class ListServices {
  constructor(
    private readonly access: BusinessAccess,
    private readonly services: ServiceRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    options: { includeArchived?: boolean } = {},
  ): Promise<ServiceRecord[]> {
    await this.access.authorize(userId, businessId);
    return this.services.list(businessId, options);
  }
}

export class GetService {
  constructor(
    private readonly access: BusinessAccess,
    private readonly services: ServiceRepository,
  ) {}

  async execute(userId: string, businessId: string, id: string): Promise<ServiceRecord> {
    await this.access.authorize(userId, businessId);
    const service = await this.services.findById(businessId, id);
    if (!service) throw new NotFoundError("Serviço");
    return service;
  }
}

export class UpdateService {
  constructor(
    private readonly access: BusinessAccess,
    private readonly services: ServiceRepository,
    private readonly materials: MaterialRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    id: string,
    input: Partial<ServiceInputData>,
  ): Promise<ServiceRecord> {
    await new GetService(this.access, this.services).execute(userId, businessId, id);

    const materials =
      input.materials === undefined
        ? undefined
        : await resolveMaterials(this.materials, businessId, input.materials);

    return this.services.update(businessId, id, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
      ...(input.desiredMargin !== undefined ? { desiredMargin: input.desiredMargin } : {}),
      ...(input.currentPriceCents !== undefined
        ? { currentPriceCents: input.currentPriceCents }
        : {}),
      ...(input.otherDirectCostCents !== undefined
        ? { otherDirectCostCents: input.otherDirectCostCents }
        : {}),
      ...(input.salesFeePercentage !== undefined
        ? { salesFeePercentage: input.salesFeePercentage }
        : {}),
      ...(materials !== undefined ? { materials } : {}),
    });
  }
}

export class ArchiveService {
  constructor(
    private readonly access: BusinessAccess,
    private readonly services: ServiceRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    id: string,
    isArchived = true,
  ): Promise<ServiceRecord> {
    await new GetService(this.access, this.services).execute(userId, businessId, id);
    return this.services.update(businessId, id, { isArchived });
  }
}

/**
 * Duplicação pedida pelo item E-04: variações do mesmo serviço, como tamanhos
 * ou acabamentos, sem recadastrar a composição inteira.
 */
export class DuplicateService {
  constructor(
    private readonly access: BusinessAccess,
    private readonly services: ServiceRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    id: string,
    input: { name?: string } = {},
  ): Promise<ServiceRecord> {
    const original = await new GetService(this.access, this.services).execute(
      userId,
      businessId,
      id,
    );

    const plan = await this.access.currentPlan(businessId);
    const limit = limitFor(plan, "services");

    const created = await this.services.createWithinLimit(
      {
        businessId,
        name: input.name?.trim() || `${original.name} (cópia)`,
        category: original.category,
        durationMinutes: original.durationMinutes,
        desiredMargin: original.desiredMargin,
        currentPriceCents: original.currentPriceCents,
        otherDirectCostCents: original.otherDirectCostCents,
        salesFeePercentage: original.salesFeePercentage,
        isArchived: false,
        materials: original.materials.map((item) => ({ ...item })),
      },
      limit,
    );

    if (!created) throw new PlanLimitError("services", limit as number, plan);
    return created;
  }
}

/**
 * Exclusão definitiva do serviço.
 *
 * Recusada quando existe cálculo no histórico apontando para ele. A chave
 * estrangeira é `SetNull`, então a exclusão não falharia — mas o cálculo
 * passaria a aparecer como avulso, sem o nome do serviço que o originou. O item
 * E-05 trata o histórico como imutável, e perder em silêncio de que serviço era
 * aquele preço contraria isso tanto quanto reescrever o número.
 *
 * O caminho é arquivar, exatamente como acontece com material em uso.
 */
export class DeleteService {
  constructor(
    private readonly access: BusinessAccess,
    private readonly services: ServiceRepository,
    private readonly calculations: CalculationRepository,
  ) {}

  async execute(userId: string, businessId: string, id: string): Promise<void> {
    await new GetService(this.access, this.services).execute(userId, businessId, id);

    if (await this.calculations.existsForService(businessId, id)) {
      throw new ConflictError(
        "Este serviço tem cálculos no histórico. Arquive em vez de excluir para não perder de onde vieram aqueles preços.",
      );
    }

    await this.services.delete(businessId, id);
  }
}

/**
 * Converte a composição informada para a unidade da compra e garante que todo
 * material citado pertence a este negócio — a tentativa de compor com material
 * alheio é recusada como material inexistente.
 */
async function resolveMaterials(
  materials: MaterialRepository,
  businessId: string,
  input: readonly ServiceMaterialInput[],
): Promise<{ materialId: string; quantityUsed: number }[]> {
  if (input.length === 0) return [];

  const ids = input.map((item) => item.materialId);
  if (new Set(ids).size !== ids.length) {
    throw new DomainError("Um material não pode aparecer duas vezes no mesmo serviço.", "materials");
  }

  const found = await materials.findManyByIds(businessId, ids);
  const byId = new Map(found.map((material) => [material.id, material]));

  return input.map((item) => {
    const material = byId.get(item.materialId);
    if (!material) {
      throw new NotFoundError("Material");
    }
    return {
      materialId: item.materialId,
      quantityUsed:
        item.unit === undefined
          ? item.quantityUsed
          : convertQuantity(item.quantityUsed, item.unit, material.unit, "materials"),
    };
  });
}
