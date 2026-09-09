import type { Request, Response } from "express";
import type { Dependencies } from "../../../application/ports/dependencies";
import { BusinessAccess } from "../../../application/services/business-access";
import {
  CreateAppointment,
  DeleteAppointment,
  GetAppointment,
  ListAppointments,
  SettleAppointment,
  SummarizeDay,
  UpdateAppointment,
  dayRange,
} from "../../../application/use-cases/appointments";
import { serializeAppointment } from "../mappers/serializers";
import { userIdOf } from "../middleware/identity";
import { parse } from "../validators/parse";
import {
  agendaQuerySchema,
  businessParamSchema,
  createAppointmentSchema,
  idParamSchema,
  settleAppointmentSchema,
  updateAppointmentSchema,
} from "../validators/schemas";

/**
 * Agenda e caixa do dia.
 *
 * O período chega em data local (`AAAA-MM-DD`) e vira intervalo aqui, na borda:
 * a aplicação trabalha com `Date`, e o aplicativo não precisa saber montar
 * fuso.
 */
export class AppointmentController {
  private readonly access: BusinessAccess;

  constructor(private readonly deps: Dependencies) {
    this.access = new BusinessAccess(deps.businesses, deps.subscriptions);
  }

  create = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const input = parse(createAppointmentSchema, req.body);

    const appointment = await new CreateAppointment(
      this.access,
      this.deps.appointments,
      this.deps.services,
    ).execute(userIdOf(req), businessId, { ...input, startsAt: new Date(input.startsAt) });

    res.status(201).json(serializeAppointment(appointment));
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const query = parse(agendaQuerySchema, req.query);
    const range = rangeOf(query);

    const items = await new ListAppointments(this.access, this.deps.appointments).execute(
      userIdOf(req),
      businessId,
      range,
    );

    res.json({ items: items.map(serializeAppointment) });
  };

  /** Resumo do dia: quantos atendimentos, quanto foi combinado e quanto entrou. */
  summary = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const query = parse(agendaQuerySchema, req.query);

    const summary = await new SummarizeDay(this.access, this.deps.appointments).execute(
      userIdOf(req),
      businessId,
      query.day ? localDate(query.day) : new Date(),
    );

    res.json(summary);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);

    const appointment = await new GetAppointment(this.access, this.deps.appointments).execute(
      userIdOf(req),
      businessId,
      id,
    );

    res.json(serializeAppointment(appointment));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);
    const input = parse(updateAppointmentSchema, req.body);

    const { startsAt, ...rest } = input;

    const appointment = await new UpdateAppointment(
      this.access,
      this.deps.appointments,
      this.deps.services,
    ).execute(userIdOf(req), businessId, id, {
      ...rest,
      ...(startsAt !== undefined ? { startsAt: new Date(startsAt) } : {}),
    });

    res.json(serializeAppointment(appointment));
  };

  /** Marca como pago; sem valor no corpo, quita o combinado. */
  settle = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);
    const input = parse(settleAppointmentSchema, req.body ?? {});

    const appointment = await new SettleAppointment(
      this.access,
      this.deps.appointments,
      this.deps.services,
    ).execute(userIdOf(req), businessId, id, input);

    res.json(serializeAppointment(appointment));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);

    await new DeleteAppointment(this.access, this.deps.appointments).execute(
      userIdOf(req),
      businessId,
      id,
    );

    res.status(204).end();
  };
}

/** `AAAA-MM-DD` no fuso de quem usa: a agenda é do dia dela, não do servidor. */
function localDate(day: string): Date {
  // O formato já veio validado como `AAAA-MM-DD`; os padrões existem só para o
  // compilador saber que as três partes estão lá.
  const [year = 1970, month = 1, date = 1] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

function rangeOf(query: { day?: string; from?: string; to?: string }): { from: Date; to: Date } {
  if (query.from && query.to) {
    const from = localDate(query.from);
    const to = localDate(query.to);
    // O fim é inclusivo para quem pede: pedir de 01 a 07 traz o dia 07 inteiro.
    to.setDate(to.getDate() + 1);
    return { from, to };
  }

  return dayRange(query.day ? localDate(query.day) : new Date());
}
