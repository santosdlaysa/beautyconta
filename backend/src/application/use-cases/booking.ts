import { randomBytes } from "node:crypto";
import {
  assertValidRange,
  availableSlots,
  formatTime,
  isSlotAvailable,
  type BusyRange,
  type TimeRange,
} from "../../domain/scheduling/availability";
import {
  assertLocalDate,
  utcToZoned,
  weekdayOf,
  zonedTimeToUtc,
  type LocalDate,
} from "../../domain/scheduling/timezone";
import { DomainError } from "../../domain/shared";
import { ConflictError, NotFoundError } from "../errors";
import type {
  AppointmentRepository,
  BusinessHoursRepository,
  BusinessRepository,
  Clock,
  ServiceRepository,
} from "../ports/repositories";
import type { AppointmentRecord, BusinessHourRecord, BusinessRecord } from "../ports/records";
import type { BusinessAccess } from "../services/business-access";

/**
 * Antecedência mínima para agendar pelo link.
 *
 * Meia hora existe para que a cliente não marque para daqui a cinco minutos com
 * a profissional no meio de outro atendimento, sem chance de ver o aviso.
 */
const LEAD_TIME_MINUTES = 30;

/** Quantos dias à frente a agenda pública aceita marcar. */
const HORIZON_DAYS = 60;

/**
 * O link precisa ser difícil de adivinhar: ele é a única barreira entre a
 * agenda e a internet. 24 bytes dão 192 bits, longe de qualquer varredura.
 */
export function createBookingToken(): string {
  return randomBytes(24).toString("base64url");
}

export type PublicService = {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  priceCents: number | null;
};

export type BookingPage = {
  businessName: string | null;
  segment: string;
  timezone: string;
  services: PublicService[];
};

/**
 * Dados que a página pública mostra.
 *
 * Devolve o mínimo: nome do negócio, serviços com preço e duração. Nada de
 * custo, margem, telefone da profissional ou identificador interno — a página é
 * aberta, e o que sai dela sai para qualquer pessoa com o link.
 *
 * Serviço sem preço não aparece: a cliente não pode escolher às cegas o que vai
 * pagar.
 */
export class GetBookingPage {
  constructor(
    private readonly businesses: BusinessRepository,
    private readonly services: ServiceRepository,
  ) {}

  async execute(token: string): Promise<BookingPage> {
    const business = await requireBookingBusiness(this.businesses, token);
    const services = await this.services.list(business.id, { includeArchived: false });

    return {
      businessName: business.name,
      segment: business.primaryCategory,
      timezone: business.timezone,
      services: services
        .filter((service) => service.currentPriceCents !== null)
        .map((service) => ({
          id: service.id,
          name: service.name,
          category: service.category,
          durationMinutes: service.durationMinutes,
          priceCents: service.currentPriceCents,
        })),
    };
  }
}

export type DayAvailability = {
  date: LocalDate;
  /** Horários no relógio do negócio, como `09:30`. */
  slots: string[];
};

/** Horários livres de um dia, para o serviço escolhido. */
export class ListAvailableSlots {
  constructor(
    private readonly businesses: BusinessRepository,
    private readonly hours: BusinessHoursRepository,
    private readonly services: ServiceRepository,
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(token: string, serviceId: string, date: string): Promise<DayAvailability> {
    assertLocalDate(date);

    const business = await requireBookingBusiness(this.businesses, token);
    const service = await this.services.findById(business.id, serviceId);

    if (!service || service.isArchived) throw new NotFoundError("Serviço");

    assertWithinHorizon(date, business.timezone, this.clock.now());

    const slots = await computeSlots({
      business,
      date,
      durationMinutes: service.durationMinutes,
      hours: this.hours,
      appointments: this.appointments,
      now: this.clock.now(),
    });

    return { date, slots: slots.map(formatTime) };
  }
}

export type BookingRequest = {
  serviceId: string;
  date: string;
  /** Horário no relógio do negócio, como `09:30`. */
  time: string;
  clientName: string;
  clientPhone: string;
  notes?: string | null;
};

/**
 * Marca o atendimento vindo do link.
 *
 * O horário é conferido duas vezes: uma para responder à cliente com clareza, e
 * outra dentro da transação que grava. A primeira sozinha não basta — entre
 * escolher e confirmar, outra pessoa pode ter pegado o mesmo horário.
 */
export class BookAppointment {
  constructor(
    private readonly businesses: BusinessRepository,
    private readonly hours: BusinessHoursRepository,
    private readonly services: ServiceRepository,
    private readonly appointments: AppointmentRepository,
    private readonly clock: Clock,
  ) {}

  async execute(token: string, request: BookingRequest): Promise<AppointmentRecord> {
    const business = await requireBookingBusiness(this.businesses, token);
    const service = await this.services.findById(business.id, request.serviceId);

    if (!service || service.isArchived) throw new NotFoundError("Serviço");
    if (service.currentPriceCents === null) {
      throw new DomainError("Este serviço ainda não está disponível para agendamento.", "serviceId");
    }

    assertLocalDate(request.date);
    assertWithinHorizon(request.date, business.timezone, this.clock.now());

    const minuto = parseRequestedTime(request.time);

    const livres = await computeSlots({
      business,
      date: request.date,
      durationMinutes: service.durationMinutes,
      hours: this.hours,
      appointments: this.appointments,
      now: this.clock.now(),
    });

    if (!livres.includes(minuto)) {
      throw new ConflictError(
        "Esse horário não está mais disponível. Escolha outro na lista, por favor.",
      );
    }

    const startsAt = zonedTimeToUtc(request.date, minuto, business.timezone);

    const criado = await this.appointments.createIfFree({
      businessId: business.id,
      serviceId: service.id,
      clientName: request.clientName.trim(),
      clientPhone: request.clientPhone.trim(),
      source: "ONLINE",
      startsAt,
      durationMinutes: service.durationMinutes,
      priceCents: service.currentPriceCents,
      paidCents: 0,
      paidAt: null,
      status: "SCHEDULED",
      notes: request.notes?.trim() || null,
    });

    // Alguém confirmou o mesmo horário no intervalo entre a conferência e a
    // gravação. A resposta é a mesma: escolha outro.
    if (!criado) {
      throw new ConflictError(
        "Esse horário acabou de ser ocupado. Escolha outro na lista, por favor.",
      );
    }

    return criado;
  }
}

export type WeeklyHours = { weekday: number; startMinute: number; endMinute: number }[];

/** Expediente da semana, usado pela agenda pública para saber quando há vaga. */
export class SaveBusinessHours {
  constructor(
    private readonly access: BusinessAccess,
    private readonly hours: BusinessHoursRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    weekly: WeeklyHours,
  ): Promise<BusinessHourRecord[]> {
    await this.access.authorize(userId, businessId);

    for (const faixa of weekly) {
      if (!Number.isInteger(faixa.weekday) || faixa.weekday < 0 || faixa.weekday > 6) {
        throw new DomainError("Dia da semana inválido.", "weekday");
      }
      assertValidRange(faixa, "workingHours");
    }

    assertNoOverlap(weekly);

    return this.hours.replaceAll(businessId, weekly);
  }
}

export class GetBusinessHours {
  constructor(
    private readonly access: BusinessAccess,
    private readonly hours: BusinessHoursRepository,
  ) {}

  async execute(userId: string, businessId: string): Promise<BusinessHourRecord[]> {
    await this.access.authorize(userId, businessId);
    return this.hours.list(businessId);
  }
}

/**
 * Liga, desliga ou troca o link da agenda pública.
 *
 * Trocar é a saída para link que vazou: o endereço antigo deixa de existir na
 * hora, sem tocar em nada que já foi marcado.
 */
export class ManageBookingLink {
  constructor(
    private readonly access: BusinessAccess,
    private readonly businesses: BusinessRepository,
  ) {}

  async enable(userId: string, businessId: string): Promise<BusinessRecord> {
    const business = await this.access.authorize(userId, businessId);
    if (business.bookingToken) return business;

    return this.businesses.setBookingToken(businessId, createBookingToken());
  }

  async regenerate(userId: string, businessId: string): Promise<BusinessRecord> {
    await this.access.authorize(userId, businessId);
    return this.businesses.setBookingToken(businessId, createBookingToken());
  }

  async disable(userId: string, businessId: string): Promise<BusinessRecord> {
    await this.access.authorize(userId, businessId);
    return this.businesses.setBookingToken(businessId, null);
  }
}

/**
 * Negócio dono do link.
 *
 * Token desconhecido e agenda desligada dão a mesma resposta, para que o
 * endereço não sirva de sonda: quem tenta adivinhar não distingue "não existe"
 * de "existe e está fechada".
 */
async function requireBookingBusiness(
  businesses: BusinessRepository,
  token: string,
): Promise<BusinessRecord> {
  const business = token ? await businesses.findByBookingToken(token) : null;
  if (!business) throw new NotFoundError("Agenda", "f");
  return business;
}

/** Horários livres de um dia, já descontando o que está marcado. */
async function computeSlots(input: {
  business: BusinessRecord;
  date: LocalDate;
  durationMinutes: number;
  hours: BusinessHoursRepository;
  appointments: AppointmentRepository;
  now: Date;
}): Promise<number[]> {
  const { business, date, durationMinutes, now } = input;

  const weekday = weekdayOf(date, business.timezone);
  const expediente = await input.hours.list(business.id);

  const workingHours: TimeRange[] = expediente
    .filter((hour) => hour.weekday === weekday)
    .map((hour) => ({ startMinute: hour.startMinute, endMinute: hour.endMinute }));

  if (workingHours.length === 0) return [];

  // O dia do negócio pode cair em dois dias UTC; a busca cobre a folga.
  const inicioDoDia = zonedTimeToUtc(date, 0, business.timezone);
  const fimDoDia = new Date(inicioDoDia.getTime() + 24 * 60 * 60_000);

  const marcados = await input.appointments.listBetween(business.id, inicioDoDia, fimDoDia);

  const busy: BusyRange[] = marcados
    // Cancelado e falta não ocupam a agenda: a vaga volta a valer.
    .filter((item) => item.status !== "CANCELED" && item.status !== "NO_SHOW")
    .map((item) => {
      const inicio = utcToZoned(item.startsAt, business.timezone);
      return {
        startMinute: inicio.minute,
        endMinute: inicio.minute + item.durationMinutes,
      };
    });

  const hoje = utcToZoned(now, business.timezone);

  return availableSlots({
    workingHours,
    busy,
    durationMinutes,
    ...(hoje.date === date ? { nowMinute: hoje.minute, leadTimeMinutes: LEAD_TIME_MINUTES } : {}),
  });
}

function parseRequestedTime(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new DomainError("Use o formato HH:MM, como 09:30.", "time");
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Passado e futuro distante ficam fora: a agenda não aceita o que não sabe. */
function assertWithinHorizon(date: LocalDate, timeZone: string, now: Date): void {
  const hoje = utcToZoned(now, timeZone).date;

  if (date < hoje) {
    throw new DomainError("Essa data já passou.", "date");
  }

  const limite = utcToZoned(new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60_000), timeZone).date;
  if (date > limite) {
    throw new DomainError(
      `A agenda aceita marcar com até ${HORIZON_DAYS} dias de antecedência.`,
      "date",
    );
  }
}

/**
 * Faixas do mesmo dia não podem se sobrepor.
 *
 * Sobreposição não quebra o cálculo — a lista já é deduplicada —, mas denuncia
 * expediente cadastrado errado, e é melhor dizer isso na hora de salvar do que
 * deixar a profissional descobrir pela agenda estranha.
 */
function assertNoOverlap(weekly: WeeklyHours): void {
  const porDia = new Map<number, WeeklyHours>();
  for (const faixa of weekly) {
    porDia.set(faixa.weekday, [...(porDia.get(faixa.weekday) ?? []), faixa]);
  }

  for (const faixas of porDia.values()) {
    const ordenadas = [...faixas].sort((a, b) => a.startMinute - b.startMinute);

    for (let i = 1; i < ordenadas.length; i += 1) {
      const anterior = ordenadas[i - 1] as WeeklyHours[number];
      const atual = ordenadas[i] as WeeklyHours[number];

      if (atual.startMinute < anterior.endMinute) {
        throw new DomainError(
          "Dois horários do mesmo dia se sobrepõem. Ajuste o início e o fim.",
          "workingHours",
        );
      }
    }
  }
}

export { isSlotAvailable };
