import { limitFor, PlanLimitError } from "../../domain/billing/plan-limits";
import type { UnitSlug } from "../../domain/catalog/catalogs";
import { ConflictError, NotFoundError } from "../errors";
import type { MaterialRepository } from "../ports/repositories";
import type { MaterialRecord } from "../ports/records";
import type { BusinessAccess } from "../services/business-access";

export type MaterialInput = {
  name: string;
  category: string;
  purchasePriceCents: number;
  purchaseQuantity: number;
  unit: UnitSlug;
  /** Fração entre 0 e 1. */
  wastePercentage?: number;
  purchaseDate?: Date | null;
};

/** Item E-01: unidade normalizada, perda, data da compra e arquivamento. */
export class RegisterMaterial {
  constructor(
    private readonly access: BusinessAccess,
    private readonly materials: MaterialRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    input: MaterialInput,
  ): Promise<MaterialRecord> {
    await this.access.authorize(userId, businessId);

    // O limite é verificado no servidor, e não na interface (item F-01) — e
    // dentro da mesma transação da inserção, senão requisições paralelas passam
    // todas pela mesma contagem e o teto vira decoração.
    const plan = await this.access.currentPlan(businessId);
    const limit = limitFor(plan, "materials");

    const created = await this.materials.createWithinLimit(
      {
        businessId,
        name: input.name.trim(),
        category: input.category,
        purchasePriceCents: input.purchasePriceCents,
        purchaseQuantity: input.purchaseQuantity,
        unit: input.unit,
        wastePercentage: input.wastePercentage ?? 0,
        purchaseDate: input.purchaseDate ?? null,
        isArchived: false,
      },
      limit,
    );

    if (!created) throw new PlanLimitError("materials", limit as number, plan);
    return created;
  }
}

export class ListMaterials {
  constructor(
    private readonly access: BusinessAccess,
    private readonly materials: MaterialRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    options: { includeArchived?: boolean } = {},
  ): Promise<MaterialRecord[]> {
    await this.access.authorize(userId, businessId);
    return this.materials.list(businessId, options);
  }
}

export class GetMaterial {
  constructor(
    private readonly access: BusinessAccess,
    private readonly materials: MaterialRepository,
  ) {}

  async execute(userId: string, businessId: string, id: string): Promise<MaterialRecord> {
    await this.access.authorize(userId, businessId);
    const material = await this.materials.findById(businessId, id);
    if (!material) throw new NotFoundError("Material");
    return material;
  }
}

/**
 * Editar um material altera cálculos futuros e nenhum cálculo passado: o
 * histórico guarda a fotografia das entradas, conforme o item E-05.
 */
export class UpdateMaterial {
  constructor(
    private readonly access: BusinessAccess,
    private readonly materials: MaterialRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    id: string,
    input: Partial<MaterialInput>,
  ): Promise<MaterialRecord> {
    await new GetMaterial(this.access, this.materials).execute(userId, businessId, id);
    return this.materials.update(businessId, id, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.purchasePriceCents !== undefined
        ? { purchasePriceCents: input.purchasePriceCents }
        : {}),
      ...(input.purchaseQuantity !== undefined
        ? { purchaseQuantity: input.purchaseQuantity }
        : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.wastePercentage !== undefined ? { wastePercentage: input.wastePercentage } : {}),
      ...(input.purchaseDate !== undefined ? { purchaseDate: input.purchaseDate } : {}),
    });
  }
}

export class ArchiveMaterial {
  constructor(
    private readonly access: BusinessAccess,
    private readonly materials: MaterialRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    id: string,
    isArchived = true,
  ): Promise<MaterialRecord> {
    await new GetMaterial(this.access, this.materials).execute(userId, businessId, id);
    return this.materials.update(businessId, id, { isArchived });
  }
}

/**
 * Exclusão definitiva. Só é aceita quando nenhum serviço usa o material; caso
 * contrário o caminho é arquivar, para não quebrar a composição já montada.
 */
export class DeleteMaterial {
  constructor(
    private readonly access: BusinessAccess,
    private readonly materials: MaterialRepository,
  ) {}

  async execute(userId: string, businessId: string, id: string): Promise<void> {
    await new GetMaterial(this.access, this.materials).execute(userId, businessId, id);

    if (await this.materials.isUsedByService(businessId, id)) {
      throw new ConflictError(
        "Este material faz parte de um serviço. Arquive em vez de excluir para preservar o histórico.",
      );
    }

    await this.materials.delete(businessId, id);
  }
}
