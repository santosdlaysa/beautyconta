import { DomainError } from "../../domain/shared";
import { NotFoundError } from "../errors";
import type { AppointmentRepository, ServiceRepository } from "../ports/repositories";
import type { AppointmentRecord, AppointmentStatusSlug } from "../ports/records";
import type { BusinessAccess } from "../services/business-access";

/**
 * Agenda do dia.
 *
 * O que a profissional acompanha aqui não é a lista de horários: é quanto do
 * combinado entrou. Por isso `priceCents` e `paidCents` andam separados — o
 * primeiro é o que foi acertado, o segundo é o que a cliente pagou de fato, e a
 * diferença entre os dois é a pergunta que o resumo do dia responde.
 */

export type AppointmentInput = {
  clientName: string;
  clientPhone?: string | null;
  serviceId?: string | null;
  startsAt: Date;
  durationMinutes: number;
  priceCents: number;
  status?: AppointmentStatusSlug;
  paidCents?: number;
  notes?: string | null;
};

/** Um dia inteiro no fuso do aparelho, das 00:00 às 23:59:59.999. */
export function dayRange(day: Date): { from: Date; to: Date } {
  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

export class CreateAppointment {
  constructor(
    private readonly access: BusinessAccess,
    private readonly appointments: AppointmentRepository,
    private readonly services: ServiceRepository,
  ) {}

  async execute(userId: string, businessId: string, input: AppointmentInput): Promise<AppointmentRecord> {
    await this.access.authorize(userId, businessId);
    await assertServiceBelongs(this.services, businessId, input.serviceId ?? null);

    return this.appointments.create({
      businessId,
      clientName: input.clientName.trim(),
      serviceId: input.serviceId ?? null,
      startsAt: input.startsAt,
      durationMinutes: input.durationMinutes,
      priceCents: input.priceCents,
      clientPhone: input.clientPhone?.trim() || null,
      // Marcado pela profissional. O que entra pelo link é gravado por
      // `BookAppointment`, que carimba `ONLINE`.
      source: "MANUAL",
      status: input.status ?? "SCHEDULED",
      paidCents: paidFor(input),
      paidAt: paidFor(input) > 0 ? new Date() : null,
      notes: input.notes?.trim() || null,
    });
  }
}

export class ListAppointments {
  constructor(
    private readonly access: BusinessAccess,
    private readonly appointments: AppointmentRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    range: { from: Date; to: Date },
  ): Promise<AppointmentRecord[]> {
    await this.access.authorize(userId, businessId);
    if (range.to <= range.from) {
      throw new DomainError("O fim do período precisa ser depois do início.", "to");
    }
    return this.appointments.listBetween(businessId, range.from, range.to);
  }
}

export class GetAppointment {
  constructor(
    private readonly access: BusinessAccess,
    private readonly appointments: AppointmentRepository,
  ) {}

  async execute(userId: string, businessId: string, id: string): Promise<AppointmentRecord> {
    await this.access.authorize(userId, businessId);
    const appointment = await this.appointments.findById(businessId, id);
    if (!appointment) throw new NotFoundError("Atendimento");
    return appointment;
  }
}

export class UpdateAppointment {
  constructor(
    private readonly access: BusinessAccess,
    private readonly appointments: AppointmentRepository,
    private readonly services: ServiceRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    id: string,
    input: Partial<AppointmentInput>,
  ): Promise<AppointmentRecord> {
    const current = await new GetAppointment(this.access, this.appointments).execute(userId, businessId, id);
    if (input.serviceId !== undefined) {
      await assertServiceBelongs(this.services, businessId, input.serviceId);
    }

    const paidCents = input.paidCents ?? current.paidCents;

    return this.appointments.update(businessId, id, {
      ...(input.clientName !== undefined ? { clientName: input.clientName.trim() } : {}),
      ...(input.clientPhone !== undefined
        ? { clientPhone: input.clientPhone?.trim() || null }
        : {}),
      ...(input.serviceId !== undefined ? { serviceId: input.serviceId } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
      ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
      ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.paidCents !== undefined
        ? {
            paidCents,
            // A data do pagamento acompanha o valor: zerar o pago desfaz a
            // marcação, e não deixa uma data órfã dizendo que entrou dinheiro.
            paidAt: paidCents > 0 ? (current.paidAt ?? new Date()) : null,
          }
        : {}),
    });
  }
}

export class DeleteAppointment {
  constructor(
    private readonly access: BusinessAccess,
    private readonly appointments: AppointmentRepository,
  ) {}

  async execute(userId: string, businessId: string, id: string): Promise<void> {
    await new GetAppointment(this.access, this.appointments).execute(userId, businessId, id);
    await this.appointments.delete(businessId, id);
  }
}

export type DaySummary = {
  appointments: number;
  /** Combinado com as clientes do dia, fora os cancelamentos. */
  expectedCents: number;
  /** O que entrou de fato. */
  receivedCents: number;
  /** Combinado que ainda não entrou; nunca negativo. */
  pendingCents: number;
  occupiedMinutes: number;
};

/**
 * Resumo do dia, que é o número que abre o aplicativo.
 *
 * Cancelado e falta não entram em nada: não são atendimento que aconteceu nem
 * dinheiro a receber. O que já foi pago continua contando mesmo assim, porque
 * sinal pago antes de cancelar é dinheiro que está no caixa.
 */
export class SummarizeDay {
  constructor(
    private readonly access: BusinessAccess,
    private readonly appointments: AppointmentRepository,
  ) {}

  async execute(userId: string, businessId: string, day: Date): Promise<DaySummary> {
    await this.access.authorize(userId, businessId);
    const { from, to } = dayRange(day);
    const items = await this.appointments.listBetween(businessId, from, to);

    return items.reduce<DaySummary>(
      (summary, item) => {
        const abandoned = item.status === "CANCELED" || item.status === "NO_SHOW";
        const expected = abandoned ? 0 : item.priceCents;

        return {
          appointments: summary.appointments + (abandoned ? 0 : 1),
          expectedCents: summary.expectedCents + expected,
          receivedCents: summary.receivedCents + item.paidCents,
          pendingCents: summary.pendingCents + Math.max(expected - item.paidCents, 0),
          occupiedMinutes: summary.occupiedMinutes + (abandoned ? 0 : item.durationMinutes),
        };
      },
      { appointments: 0, expectedCents: 0, receivedCents: 0, pendingCents: 0, occupiedMinutes: 0 },
    );
  }
}

/** Pagamento total com um toque: o caminho que a agenda usa o dia inteiro. */
export class SettleAppointment {
  constructor(
    private readonly access: BusinessAccess,
    private readonly appointments: AppointmentRepository,
    private readonly services: ServiceRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    id: string,
    input: { paidCents?: number } = {},
  ): Promise<AppointmentRecord> {
    const current = await new GetAppointment(this.access, this.appointments).execute(userId, businessId, id);
    const paidCents = input.paidCents ?? current.priceCents;

    return new UpdateAppointment(this.access, this.appointments, this.services).execute(userId, businessId, id, {
      paidCents,
      status: "DONE",
    });
  }
}

const paidFor = (input: AppointmentInput): number => input.paidCents ?? 0;

async function assertServiceBelongs(
  services: ServiceRepository,
  businessId: string,
  serviceId: string | null,
): Promise<void> {
  if (!serviceId) return;
  const service = await services.findById(businessId, serviceId);
  if (!service) throw new NotFoundError("Serviço");
}
