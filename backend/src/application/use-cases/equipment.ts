import { NotFoundError } from "../errors";
import { assertValidEquipment } from "../../domain/equipment/reserve";
import type { Clock, EquipmentRepository } from "../ports/repositories";
import type { EquipmentRecord } from "../ports/records";
import type { BusinessAccess } from "../services/business-access";

/**
 * Cadastro de equipamentos do documento 07.
 *
 * A reserva mensal para reposição **entra no custo fixo** desde 2026-09-10, e
 * daí no rateio, exatamente como manda a seção 6 do documento: ela não cria
 * termo novo na fórmula do documento 03.
 *
 * É por isso que a categoria `equipment_reserve` do catálogo de custos fixos é
 * bloqueada para lançamento manual: quem lançasse a reserva à mão pagaria duas
 * vezes pelo mesmo desgaste.
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
    private readonly clock: Clock,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    input: EquipmentInput,
  ): Promise<EquipmentRecord> {
    await this.access.authorize(userId, businessId);

    // Regras da seção 8 do documento 07. Elas importam mais do que parece: a
    // reserva entra no custo fixo, e revenda maior que a compra ou vida útil de
    // um mês distorcem o preço de todos os serviços.
    assertValidEquipment({
      acquisitionPriceCents: input.acquisitionPriceCents,
      residualValueCents: input.residualValueCents ?? 0,
      usefulLifeMonths: input.usefulLifeMonths,
      acquisitionDate: input.acquisitionDate,
      now: this.clock.now(),
    });

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
    private readonly clock: Clock,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    id: string,
    input: Partial<EquipmentInput> & { isArchived?: boolean },
  ): Promise<EquipmentRecord> {
    const atual = await new GetEquipment(this.access, this.equipment).execute(
      userId,
      businessId,
      id,
    );

    // As mesmas regras do cadastro, sobre o registro já mesclado.
    //
    // Validar só na criação deixava o `PATCH` gravar o que o `POST` recusa —
    // revenda maior que a compra, vida útil absurda, data no futuro — e cada um
    // desses distorce a reserva, que hoje entra no custo fixo de todos os
    // serviços. A interface se protegia sozinha; qualquer outro cliente, não.
    assertValidEquipment({
      acquisitionPriceCents: input.acquisitionPriceCents ?? atual.acquisitionPriceCents,
      residualValueCents: input.residualValueCents ?? atual.residualValueCents,
      usefulLifeMonths: input.usefulLifeMonths ?? atual.usefulLifeMonths,
      acquisitionDate: input.acquisitionDate ?? atual.acquisitionDate,
      now: this.clock.now(),
    });

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
