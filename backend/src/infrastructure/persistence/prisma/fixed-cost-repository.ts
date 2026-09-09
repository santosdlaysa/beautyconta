import type { FixedCost, PrismaClient } from "@prisma/client";
import type { FixedCostRepository } from "../../../application/ports/repositories";
import type { FixedCostRecord } from "../../../application/ports/records";
import { centsToNumber, numberToCents } from "./mappers";
import { createWithinLimit } from "./within-limit";

export class PrismaFixedCostRepository implements FixedCostRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    input: Omit<FixedCostRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<FixedCostRecord> {
    return toRecord(await this.prisma.fixedCost.create({ data: toData(input) }));
  }

  async createWithinLimit(
    input: Omit<FixedCostRecord, "id" | "createdAt" | "updatedAt">,
    limit: number | null,
  ): Promise<FixedCostRecord | null> {
    const created = await createWithinLimit(
      this.prisma,
      { table: "businesses", id: input.businessId },
      limit,
      (tx) => tx.fixedCost.count({ where: { businessId: input.businessId } }),
      (tx) => tx.fixedCost.create({ data: toData(input) }),
    );
    return created ? toRecord(created) : null;
  }

  async findById(businessId: string, id: string): Promise<FixedCostRecord | null> {
    const fixedCost = await this.prisma.fixedCost.findFirst({ where: { id, businessId } });
    return fixedCost ? toRecord(fixedCost) : null;
  }

  async list(
    businessId: string,
    options: { includeInactive?: boolean } = {},
  ): Promise<FixedCostRecord[]> {
    const items = await this.prisma.fixedCost.findMany({
      where: { businessId, ...(options.includeInactive ? {} : { isActive: true }) },
      orderBy: { name: "asc" },
    });
    return items.map(toRecord);
  }

  count(businessId: string): Promise<number> {
    return this.prisma.fixedCost.count({ where: { businessId } });
  }

  /** Só o que está ativo entra no `CF` do mês. */
  async monthlyTotalCents(businessId: string): Promise<number> {
    const result = await this.prisma.fixedCost.aggregate({
      where: { businessId, isActive: true },
      _sum: { monthlyAmount: true },
    });
    return centsToNumber(result._sum.monthlyAmount ?? 0n);
  }

  async update(
    businessId: string,
    id: string,
    input: Partial<Omit<FixedCostRecord, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<FixedCostRecord> {
    await this.prisma.fixedCost.updateMany({
      where: { id, businessId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.monthlyAmountCents !== undefined
          ? { monthlyAmount: numberToCents(input.monthlyAmountCents) }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });

    const updated = await this.findById(businessId, id);
    if (!updated) throw new Error("Custo fixo desapareceu durante a atualização.");
    return updated;
  }

  async delete(businessId: string, id: string): Promise<void> {
    await this.prisma.fixedCost.deleteMany({ where: { id, businessId } });
  }
}

function toData(input: Omit<FixedCostRecord, "id" | "createdAt" | "updatedAt">) {
  return {
    businessId: input.businessId,
    name: input.name,
    category: input.category,
    monthlyAmount: numberToCents(input.monthlyAmountCents),
    isActive: input.isActive,
  };
}

function toRecord(fixedCost: FixedCost): FixedCostRecord {
  return {
    id: fixedCost.id,
    businessId: fixedCost.businessId,
    name: fixedCost.name,
    category: fixedCost.category,
    monthlyAmountCents: centsToNumber(fixedCost.monthlyAmount),
    isActive: fixedCost.isActive,
    createdAt: fixedCost.createdAt,
    updatedAt: fixedCost.updatedAt,
  };
}
