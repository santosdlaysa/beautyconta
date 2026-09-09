import type { Appointment, PrismaClient } from "@prisma/client";
import type { AppointmentRepository } from "../../../application/ports/repositories";
import type { AppointmentRecord } from "../../../application/ports/records";
import { centsToNumber, numberToCents } from "./mappers";

/**
 * Atendimentos no PostgreSQL.
 *
 * Toda leitura carrega `businessId` na cláusula, e não só na consulta por id: é
 * o isolamento do item B-03 aplicado onde ele importa, na borda que fala com o
 * banco.
 */
export class PrismaAppointmentRepository implements AppointmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: Omit<AppointmentRecord, "id" | "createdAt" | "updatedAt">): Promise<AppointmentRecord> {
    return toRecord(
      await this.prisma.appointment.create({
        data: {
          businessId: input.businessId,
          serviceId: input.serviceId,
          clientName: input.clientName,
          startsAt: input.startsAt,
          durationMinutes: input.durationMinutes,
          priceCents: numberToCents(input.priceCents),
          paidCents: numberToCents(input.paidCents),
          paidAt: input.paidAt,
          status: input.status,
          notes: input.notes,
        },
      }),
    );
  }

  async findById(businessId: string, id: string): Promise<AppointmentRecord | null> {
    const appointment = await this.prisma.appointment.findFirst({ where: { id, businessId } });
    return appointment ? toRecord(appointment) : null;
  }

  async listBetween(businessId: string, from: Date, to: Date): Promise<AppointmentRecord[]> {
    const items = await this.prisma.appointment.findMany({
      where: { businessId, startsAt: { gte: from, lt: to } },
      orderBy: { startsAt: "asc" },
    });
    return items.map(toRecord);
  }

  async update(
    businessId: string,
    id: string,
    input: Partial<Omit<AppointmentRecord, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<AppointmentRecord> {
    const { count } = await this.prisma.appointment.updateMany({
      where: { id, businessId },
      data: {
        ...(input.clientName !== undefined ? { clientName: input.clientName } : {}),
        ...(input.serviceId !== undefined ? { serviceId: input.serviceId } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
        ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
        ...(input.priceCents !== undefined ? { priceCents: numberToCents(input.priceCents) } : {}),
        ...(input.paidCents !== undefined ? { paidCents: numberToCents(input.paidCents) } : {}),
        ...(input.paidAt !== undefined ? { paidAt: input.paidAt } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    // `updateMany` filtra pelo negócio; zero linhas significa que o registro não
    // é desta usuária, e quem traduz isso para negativa é o caso de uso.
    if (count === 0) throw new Error("Atendimento não encontrado para este negócio.");

    const updated = await this.prisma.appointment.findFirstOrThrow({ where: { id, businessId } });
    return toRecord(updated);
  }

  async delete(businessId: string, id: string): Promise<void> {
    await this.prisma.appointment.deleteMany({ where: { id, businessId } });
  }
}

function toRecord(appointment: Appointment): AppointmentRecord {
  return {
    id: appointment.id,
    businessId: appointment.businessId,
    serviceId: appointment.serviceId,
    clientName: appointment.clientName,
    startsAt: appointment.startsAt,
    durationMinutes: appointment.durationMinutes,
    priceCents: centsToNumber(appointment.priceCents),
    paidCents: centsToNumber(appointment.paidCents),
    paidAt: appointment.paidAt,
    status: appointment.status,
    notes: appointment.notes,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  };
}
