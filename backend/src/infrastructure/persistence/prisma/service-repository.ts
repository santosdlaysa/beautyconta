import type { Prisma, PrismaClient, Service, ServiceMaterial } from "@prisma/client";
import type { ServiceInput, ServiceRepository } from "../../../application/ports/repositories";
import type { ServiceRecord } from "../../../application/ports/records";
import { centsToNumber, decimalToNumber, numberToCents, numberToDecimal } from "./mappers";
import { createWithinLimit } from "./within-limit";

type ServiceWithMaterials = Service & { materials: ServiceMaterial[] };

export class PrismaServiceRepository implements ServiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: ServiceInput): Promise<ServiceRecord> {
    return toRecord(
      await this.prisma.service.create({ data: toData(input), include: { materials: true } }),
    );
  }

  async createWithinLimit(
    input: ServiceInput,
    limit: number | null,
  ): Promise<ServiceRecord | null> {
    const created = await createWithinLimit(
      this.prisma,
      { table: "businesses", id: input.businessId },
      limit,
      (tx) => tx.service.count({ where: { businessId: input.businessId } }),
      (tx) => tx.service.create({ data: toData(input), include: { materials: true } }),
    );
    return created ? toRecord(created) : null;
  }

  async findById(businessId: string, id: string): Promise<ServiceRecord | null> {
    const service = await this.prisma.service.findFirst({
      where: { id, businessId },
      include: { materials: true },
    });
    return service ? toRecord(service) : null;
  }

  async list(
    businessId: string,
    options: { includeArchived?: boolean } = {},
  ): Promise<ServiceRecord[]> {
    const services = await this.prisma.service.findMany({
      where: { businessId, ...(options.includeArchived ? {} : { isArchived: false }) },
      include: { materials: true },
      orderBy: { name: "asc" },
    });
    return services.map(toRecord);
  }

  count(businessId: string): Promise<number> {
    return this.prisma.service.count({ where: { businessId } });
  }

  /**
   * A composição é substituída inteira, dentro de uma transação: um serviço com
   * metade dos materiais trocados nunca chega a existir para outra leitura.
   */
  async update(
    businessId: string,
    id: string,
    input: Partial<Omit<ServiceRecord, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<ServiceRecord> {
    const data: Prisma.ServiceUpdateManyMutationInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
      ...(input.desiredMargin !== undefined
        ? { desiredMargin: numberToDecimal(input.desiredMargin) }
        : {}),
      ...(input.currentPriceCents !== undefined
        ? {
            currentPrice:
              input.currentPriceCents === null ? null : numberToCents(input.currentPriceCents),
          }
        : {}),
      ...(input.otherDirectCostCents !== undefined
        ? { otherDirectCost: numberToCents(input.otherDirectCostCents) }
        : {}),
      ...(input.salesFeePercentage !== undefined
        ? { salesFeePercentage: numberToDecimal(input.salesFeePercentage) }
        : {}),
      ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.service.updateMany({ where: { id, businessId }, data });

      if (input.materials !== undefined) {
        await tx.serviceMaterial.deleteMany({ where: { serviceId: id } });
        if (input.materials.length > 0) {
          await tx.serviceMaterial.createMany({
            data: input.materials.map((item) => ({
              serviceId: id,
              materialId: item.materialId,
              quantityUsed: numberToDecimal(item.quantityUsed),
            })),
          });
        }
      }
    });

    const updated = await this.findById(businessId, id);
    if (!updated) throw new Error("Serviço desapareceu durante a atualização.");
    return updated;
  }

  async delete(businessId: string, id: string): Promise<void> {
    await this.prisma.service.deleteMany({ where: { id, businessId } });
  }
}

function toData(input: ServiceInput) {
  return {
    businessId: input.businessId,
    name: input.name,
    category: input.category,
    durationMinutes: input.durationMinutes,
    desiredMargin: numberToDecimal(input.desiredMargin),
    currentPrice:
      input.currentPriceCents === null ? null : numberToCents(input.currentPriceCents),
    otherDirectCost: numberToCents(input.otherDirectCostCents),
    salesFeePercentage: numberToDecimal(input.salesFeePercentage),
    isArchived: input.isArchived,
    materials: {
      create: input.materials.map((item) => ({
        materialId: item.materialId,
        quantityUsed: numberToDecimal(item.quantityUsed),
      })),
    },
  };
}

function toRecord(service: ServiceWithMaterials): ServiceRecord {
  return {
    id: service.id,
    businessId: service.businessId,
    name: service.name,
    category: service.category,
    durationMinutes: service.durationMinutes,
    desiredMargin: decimalToNumber(service.desiredMargin),
    currentPriceCents: service.currentPrice === null ? null : centsToNumber(service.currentPrice),
    otherDirectCostCents: centsToNumber(service.otherDirectCost),
    salesFeePercentage: decimalToNumber(service.salesFeePercentage),
    isArchived: service.isArchived,
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
    materials: service.materials.map((item) => ({
      materialId: item.materialId,
      quantityUsed: decimalToNumber(item.quantityUsed),
    })),
  };
}
