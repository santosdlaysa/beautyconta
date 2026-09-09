import type { BusinessHour, PrismaClient } from "@prisma/client";
import type { BusinessHoursRepository } from "../../../application/ports/repositories";
import type { BusinessHourRecord } from "../../../application/ports/records";

export class PrismaBusinessHoursRepository implements BusinessHoursRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(businessId: string): Promise<BusinessHourRecord[]> {
    const hours = await this.prisma.businessHour.findMany({
      where: { businessId },
      orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
    });
    return hours.map(toRecord);
  }

  /**
   * Substitui a semana inteira dentro de uma transação.
   *
   * Apagar e inserir em passos separados deixaria uma janela com o expediente
   * pela metade — e é dela que a agenda pública tira os horários livres. Meio
   * expediente publicado é horário oferecido que não existe.
   */
  async replaceAll(
    businessId: string,
    hours: readonly Omit<BusinessHourRecord, "id" | "businessId">[],
  ): Promise<BusinessHourRecord[]> {
    await this.prisma.$transaction(async (tx) => {
      await tx.businessHour.deleteMany({ where: { businessId } });

      if (hours.length > 0) {
        await tx.businessHour.createMany({
          data: hours.map((hour) => ({
            businessId,
            weekday: hour.weekday,
            startMinute: hour.startMinute,
            endMinute: hour.endMinute,
          })),
        });
      }
    });

    return this.list(businessId);
  }
}

function toRecord(hour: BusinessHour): BusinessHourRecord {
  return {
    id: hour.id,
    businessId: hour.businessId,
    weekday: hour.weekday,
    startMinute: hour.startMinute,
    endMinute: hour.endMinute,
  };
}
