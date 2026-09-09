import { NotFoundError } from "../errors";
import type { EquipmentRepository } from "../ports/repositories";
import type { EquipmentRecord } from "../ports/records";
import type { BusinessAccess } from "../services/business-access";

/**
 * Cadastro de equipamentos do documento 07.
 *
 * Está fora do MVP: a reserva mensal para reposição ainda não entra no rateio
 * de custo fixo. O cadastro existe para que o dado comece a ser coletado sem
 * migração depois — e a categoria `equipment_reserve` continua bloqueada para
 * lançamento manual até que o cálculo exista.
 */
export type EquipmentInput = {
  name: string;
  type: string;
  acquisitionPriceCents: number;
  residualValueCents?: number;
  usefulLifeMonths: number;
  acquisitionDate: Date;
};

export class RegisterEquipment {
  constructor(
    private readonly access: BusinessAccess,
    private readonly equipment: EquipmentRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    input: EquipmentInput,
  ): Promise<EquipmentRecord> {
    await this.access.authorize(userId, businessId);
    return this.equipment.create({
      businessId,
      name: input.name.trim(),
      type: input.type,
      acquisitionPriceCents: input.acquisitionPriceCents,
      residualValueCents: input.residualValueCents ?? 0,
      usefulLifeMonths: input.usefulLifeMonths,
      acquisitionDate: input.acquisitionDate,
      isArchived: false,
    });
  }
}

export class ListEquipment {
  constructor(
    private readonly access: BusinessAccess,
    private readonly equipment: EquipmentRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    options: { includeArchived?: boolean } = {},
  ): Promise<EquipmentRecord[]> {
    await this.access.authorize(userId, businessId);
    return this.equipment.list(businessId, options);
  }
}

export class GetEquipment {
  constructor(
    private readonly access: BusinessAccess,
    private readonly equipment: EquipmentRepository,
  ) {}

  async execute(userId: string, businessId: string, id: string): Promise<EquipmentRecord> {
    await this.access.authorize(userId, businessId);
    const item = await this.equipment.findById(businessId, id);
    if (!item) throw new NotFoundError("Equipamento");
    return item;
  }
}

export class UpdateEquipment {
  constructor(
    private readonly access: BusinessAccess,
    private readonly equipment: EquipmentRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    id: string,
    input: Partial<EquipmentInput> & { isArchived?: boolean },
  ): Promise<EquipmentRecord> {
    await new GetEquipment(this.access, this.equipment).execute(userId, businessId, id);
    return this.equipment.update(businessId, id, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.acquisitionPriceCents !== undefined
        ? { acquisitionPriceCents: input.acquisitionPriceCents }
        : {}),
      ...(input.residualValueCents !== undefined
        ? { residualValueCents: input.residualValueCents }
        : {}),
      ...(input.usefulLifeMonths !== undefined
        ? { usefulLifeMonths: input.usefulLifeMonths }
        : {}),
      ...(input.acquisitionDate !== undefined ? { acquisitionDate: input.acquisitionDate } : {}),
      ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
    });
  }
}

export class DeleteEquipment {
  constructor(
    private readonly access: BusinessAccess,
    private readonly equipment: EquipmentRepository,
  ) {}

  async execute(userId: string, businessId: string, id: string): Promise<void> {
    await new GetEquipment(this.access, this.equipment).execute(userId, businessId, id);
    await this.equipment.delete(businessId, id);
  }
}
