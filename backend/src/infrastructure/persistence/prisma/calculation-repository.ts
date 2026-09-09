import { Prisma, type PricingCalculation, type PrismaClient } from "@prisma/client";
import type { CalculationRepository } from "../../../application/ports/repositories";
import type { PricingCalculationRecord } from "../../../application/ports/records";
import { centsToNumber, decimalToNumber, numberToCents, numberToDecimal } from "./mappers";

export class PrismaCalculationRepository implements CalculationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    input: Omit<PricingCalculationRecord, "id" | "createdAt">,
  ): Promise<PricingCalculationRecord> {
    return toRecord(
      await this.prisma.pricingCalculation.create({
        data: {
          businessId: input.businessId,
          serviceId: input.serviceId,
          calculationVersion: input.calculationVersion,
          inputSnapshot: input.inputSnapshot as Prisma.InputJsonValue,
          materialCost: numberToCents(input.materialCostCents),
          laborCost: numberToCents(input.laborCostCents),
          allocatedFixedCost: numberToCents(input.allocatedFixedCostCents),
          otherDirectCost: numberToCents(input.otherDirectCostCents),
          totalBaseCost: numberToCents(input.totalBaseCostCents),
          minimumPrice: numberToCents(input.minimumPriceCents),
          suggestedPrice: numberToCents(input.suggestedPriceCents),
          commercialPrice: numberToCents(input.commercialPriceCents),
          expectedProfit: numberToCents(input.expectedProfitCents),
          expectedMargin: numberToDecimal(input.expectedMargin),
        },
      }),
    );
  }

  async findById(businessId: string, id: string): Promise<PricingCalculationRecord | null> {
    const calculation = await this.prisma.pricingCalculation.findFirst({
      where: { id, businessId },
    });
    return calculation ? toRecord(calculation) : null;
  }

  /**
   * `limit` nulo significa histórico completo. O recorte do plano gratuito é
   * aplicado na leitura; nenhum registro é removido do banco.
   */
  async list(
    businessId: string,
    options: { limit?: number | null; serviceId?: string } = {},
  ): Promise<PricingCalculationRecord[]> {
    const calculations = await this.prisma.pricingCalculation.findMany({
      where: { businessId, ...(options.serviceId ? { serviceId: options.serviceId } : {}) },
      orderBy: { createdAt: "desc" },
      ...(options.limit ? { take: options.limit } : {}),
    });
    return calculations.map(toRecord);
  }

  count(businessId: string): Promise<number> {
    return this.prisma.pricingCalculation.count({ where: { businessId } });
  }

  async existsForService(businessId: string, serviceId: string): Promise<boolean> {
    const found = await this.prisma.pricingCalculation.findFirst({
      where: { businessId, serviceId },
      select: { id: true },
    });
    return found !== null;
  }
}

function toRecord(calculation: PricingCalculation): PricingCalculationRecord {
  return {
    id: calculation.id,
    businessId: calculation.businessId,
    serviceId: calculation.serviceId,
    calculationVersion: calculation.calculationVersion,
    inputSnapshot: calculation.inputSnapshot,
    materialCostCents: centsToNumber(calculation.materialCost),
    laborCostCents: centsToNumber(calculation.laborCost),
    allocatedFixedCostCents: centsToNumber(calculation.allocatedFixedCost),
    otherDirectCostCents: centsToNumber(calculation.otherDirectCost),
    totalBaseCostCents: centsToNumber(calculation.totalBaseCost),
    minimumPriceCents: centsToNumber(calculation.minimumPrice),
    suggestedPriceCents: centsToNumber(calculation.suggestedPrice),
    commercialPriceCents: centsToNumber(calculation.commercialPrice),
    expectedProfitCents: centsToNumber(calculation.expectedProfit),
    expectedMargin: decimalToNumber(calculation.expectedMargin),
    createdAt: calculation.createdAt,
  };
}
