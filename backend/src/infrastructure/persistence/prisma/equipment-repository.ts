import type { Equipment, PrismaClient } from "@prisma/client";
import type { EquipmentRepository } from "../../../application/ports/repositories";
import type { EquipmentRecord } from "../../../application/ports/records";
import { centsToNumber, numberToCents } from "./mappers";

export class PrismaEquipmentRepository implements EquipmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    input: Omit<EquipmentRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<EquipmentRecord> {
    return toRecord(
      await this.prisma.equipment.create({
        data: {
          businessId: input.businessId,
          name: input.name,
          type: input.type,
          acquisitionPrice: numberToCents(input.acquisitionPriceCents),
          residualValue: numberToCents(input.residualValueCents),
          usefulLifeMonths: input.usefulLifeMonths,
          acquisitionDate: input.acquisitionDate,
          isArchived: input.isArchived,
        },
      }),
    );
  }

  async findById(businessId: string, id: string): Promise<EquipmentRecord | null> {
    const equipment = await this.prisma.equipment.findFirst({ where: { id, businessId } });
    return equipment ? toRecord(equipment) : null;
  }

  async list(
    businessId: string,
    options: { includeArchived?: boolean } = {},
  ): Promise<EquipmentRecord[]> {
    const items = await this.prisma.equipment.findMany({
      where: { businessId, ...(options.includeArchived ? {} : { isArchived: false }) },
      orderBy: { name: "asc" },
    });
    return items.map(toRecord);
  }

  async update(
    businessId: string,
    id: string,
    input: Partial<Omit<EquipmentRecord, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<EquipmentRecord> {
    await this.prisma.equipment.updateMany({
      where: { id, businessId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.acquisitionPriceCents !== undefined
          ? { acquisitionPrice: numberToCents(input.acquisitionPriceCents) }
          : {}),
        ...(input.residualValueCents !== undefined
          ? { residualValue: numberToCents(input.residualValueCents) }
          : {}),
        ...(input.usefulLifeMonths !== undefined
          ? { usefulLifeMonths: input.usefulLifeMonths }
          : {}),
        ...(input.acquisitionDate !== undefined ? { acquisitionDate: input.acquisitionDate } : {}),
        ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
      },
    });

    const updated = await this.findById(businessId, id);
    if (!updated) throw new Error("Equipamento desapareceu durante a atualização.");
    return updated;
  }

  async delete(businessId: string, id: string): Promise<void> {
    await this.prisma.equipment.deleteMany({ where: { id, businessId } });
  }
}

function toRecord(equipment: Equipment): EquipmentRecord {
  return {
    id: equipment.id,
    businessId: equipment.businessId,
    name: equipment.name,
    type: equipment.type,
    acquisitionPriceCents: centsToNumber(equipment.acquisitionPrice),
    residualValueCents: centsToNumber(equipment.residualValue),
    usefulLifeMonths: equipment.usefulLifeMonths,
    acquisitionDate: equipment.acquisitionDate,
    isArchived: equipment.isArchived,
    createdAt: equipment.createdAt,
    updatedAt: equipment.updatedAt,
  };
}
