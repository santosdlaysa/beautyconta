import type { Material, PrismaClient } from "@prisma/client";
import type { UnitSlug } from "../../../domain/catalog/catalogs";
import type { MaterialRepository } from "../../../application/ports/repositories";
import type { MaterialRecord } from "../../../application/ports/records";
import { centsToNumber, decimalToNumber, numberToCents, numberToDecimal } from "./mappers";
import { createWithinLimit } from "./within-limit";

export class PrismaMaterialRepository implements MaterialRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    input: Omit<MaterialRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<MaterialRecord> {
    return toRecord(await this.prisma.material.create({ data: toData(input) }));
  }

  async createWithinLimit(
    input: Omit<MaterialRecord, "id" | "createdAt" | "updatedAt">,
    limit: number | null,
  ): Promise<MaterialRecord | null> {
    const created = await createWithinLimit(
      this.prisma,
      { table: "businesses", id: input.businessId },
      limit,
      (tx) => tx.material.count({ where: { businessId: input.businessId } }),
      (tx) => tx.material.create({ data: toData(input) }),
    );
    return created ? toRecord(created) : null;
  }

  /** O `businessId` no `where` é o isolamento do item B-03, não um detalhe. */
  async findById(businessId: string, id: string): Promise<MaterialRecord | null> {
    const material = await this.prisma.material.findFirst({ where: { id, businessId } });
    return material ? toRecord(material) : null;
  }

  async findManyByIds(businessId: string, ids: readonly string[]): Promise<MaterialRecord[]> {
    if (ids.length === 0) return [];
    const materials = await this.prisma.material.findMany({
      where: { businessId, id: { in: [...ids] } },
    });
    return materials.map(toRecord);
  }

  async list(
    businessId: string,
    options: { includeArchived?: boolean } = {},
  ): Promise<MaterialRecord[]> {
    const materials = await this.prisma.material.findMany({
      where: { businessId, ...(options.includeArchived ? {} : { isArchived: false }) },
      orderBy: { name: "asc" },
    });
    return materials.map(toRecord);
  }

  /** Conta tudo, inclusive arquivado: o limite do plano é de cadastro. */
  count(businessId: string): Promise<number> {
    return this.prisma.material.count({ where: { businessId } });
  }

  async update(
    businessId: string,
    id: string,
    input: Partial<Omit<MaterialRecord, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<MaterialRecord> {
    await this.prisma.material.updateMany({
      where: { id, businessId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.purchasePriceCents !== undefined
          ? { purchasePrice: numberToCents(input.purchasePriceCents) }
          : {}),
        ...(input.purchaseQuantity !== undefined
          ? { purchaseQuantity: numberToDecimal(input.purchaseQuantity) }
          : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.wastePercentage !== undefined
          ? { wastePercentage: numberToDecimal(input.wastePercentage) }
          : {}),
        ...(input.purchaseDate !== undefined ? { purchaseDate: input.purchaseDate } : {}),
        ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
      },
    });

    const updated = await this.findById(businessId, id);
    if (!updated) throw new Error("Material desapareceu durante a atualização.");
    return updated;
  }

  async delete(businessId: string, id: string): Promise<void> {
    await this.prisma.material.deleteMany({ where: { id, businessId } });
  }

  async isUsedByService(businessId: string, id: string): Promise<boolean> {
    const count = await this.prisma.serviceMaterial.count({
      where: { materialId: id, material: { businessId } },
    });
    return count > 0;
  }
}

function toData(input: Omit<MaterialRecord, "id" | "createdAt" | "updatedAt">) {
  return {
    businessId: input.businessId,
    name: input.name,
    category: input.category,
    purchasePrice: numberToCents(input.purchasePriceCents),
    purchaseQuantity: numberToDecimal(input.purchaseQuantity),
    unit: input.unit,
    wastePercentage: numberToDecimal(input.wastePercentage),
    purchaseDate: input.purchaseDate,
    isArchived: input.isArchived,
  };
}

function toRecord(material: Material): MaterialRecord {
  return {
    id: material.id,
    businessId: material.businessId,
    name: material.name,
    category: material.category,
    purchasePriceCents: centsToNumber(material.purchasePrice),
    purchaseQuantity: decimalToNumber(material.purchaseQuantity),
    unit: material.unit as UnitSlug,
    wastePercentage: decimalToNumber(material.wastePercentage),
    purchaseDate: material.purchaseDate,
    isArchived: material.isArchived,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
  };
}
