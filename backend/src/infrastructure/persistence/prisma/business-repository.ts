import type { Business, BusinessSettings, PrismaClient } from "@prisma/client";
import type { SegmentSlug, WorkModelSlug } from "../../../domain/catalog/catalogs";
import type { BusinessRepository } from "../../../application/ports/repositories";
import type {
  AllocationMethodSlug,
  BusinessRecord,
  BusinessSettingsRecord,
  RoundingStrategySlug,
} from "../../../application/ports/records";
import { centsToNumber, decimalToNumber, numberToCents, numberToDecimal } from "./mappers";
import { createWithinLimit } from "./within-limit";

export class PrismaBusinessRepository implements BusinessRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    input: Omit<BusinessRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<BusinessRecord> {
    return toRecord(await this.prisma.business.create({ data: toData(input) }));
  }

  async createWithinLimit(
    input: Omit<BusinessRecord, "id" | "createdAt" | "updatedAt">,
    limit: number | null,
  ): Promise<BusinessRecord | null> {
    const created = await createWithinLimit(
      this.prisma,
      { table: "users", id: input.ownerUserId },
      limit,
      (tx) => tx.business.count({ where: { ownerUserId: input.ownerUserId } }),
      (tx) => tx.business.create({ data: toData(input) }),
    );
    return created ? toRecord(created) : null;
  }

  async findById(id: string): Promise<BusinessRecord | null> {
    const business = await this.prisma.business.findUnique({ where: { id } });
    return business ? toRecord(business) : null;
  }

  async listByOwner(ownerUserId: string): Promise<BusinessRecord[]> {
    const businesses = await this.prisma.business.findMany({
      where: { ownerUserId },
      orderBy: { createdAt: "asc" },
    });
    return businesses.map(toRecord);
  }

  async update(
    id: string,
    input: Partial<Pick<BusinessRecord, "name" | "primaryCategory" | "workModel" | "timezone">>,
  ): Promise<BusinessRecord> {
    return toRecord(await this.prisma.business.update({ where: { id }, data: input }));
  }

  async getSettings(businessId: string): Promise<BusinessSettingsRecord | null> {
    const settings = await this.prisma.businessSettings.findUnique({ where: { businessId } });
    return settings ? toSettingsRecord(settings) : null;
  }

  /** Gravação idempotente: o onboarding pode repetir a mesma etapa. */
  async saveSettings(
    input: Omit<BusinessSettingsRecord, "createdAt" | "updatedAt">,
  ): Promise<BusinessSettingsRecord> {
    const data = {
      desiredMonthlyWithdrawal: numberToCents(input.desiredMonthlyWithdrawalCents),
      productiveHoursPerMonth: numberToDecimal(input.productiveHoursPerMonth),
      estimatedAppointmentsPerMonth: input.estimatedAppointmentsPerMonth,
      fixedCostAllocationMethod: input.fixedCostAllocationMethod,
      roundingStrategy: input.roundingStrategy,
    };

    return toSettingsRecord(
      await this.prisma.businessSettings.upsert({
        where: { businessId: input.businessId },
        create: { businessId: input.businessId, ...data },
        update: data,
      }),
    );
  }
}

function toData(input: Omit<BusinessRecord, "id" | "createdAt" | "updatedAt">) {
  return {
    ownerUserId: input.ownerUserId,
    name: input.name,
    primaryCategory: input.primaryCategory,
    workModel: input.workModel,
    currency: input.currency,
    timezone: input.timezone,
  };
}

function toRecord(business: Business): BusinessRecord {
  return {
    id: business.id,
    ownerUserId: business.ownerUserId,
    name: business.name,
    primaryCategory: business.primaryCategory as SegmentSlug,
    workModel: business.workModel as WorkModelSlug,
    currency: business.currency,
    timezone: business.timezone,
    createdAt: business.createdAt,
    updatedAt: business.updatedAt,
  };
}

function toSettingsRecord(settings: BusinessSettings): BusinessSettingsRecord {
  return {
    businessId: settings.businessId,
    desiredMonthlyWithdrawalCents: centsToNumber(settings.desiredMonthlyWithdrawal),
    productiveHoursPerMonth: decimalToNumber(settings.productiveHoursPerMonth),
    estimatedAppointmentsPerMonth: settings.estimatedAppointmentsPerMonth,
    fixedCostAllocationMethod: settings.fixedCostAllocationMethod as AllocationMethodSlug,
    roundingStrategy: settings.roundingStrategy as RoundingStrategySlug,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
}
