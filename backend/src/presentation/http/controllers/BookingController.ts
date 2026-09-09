import type { Request, Response } from "express";
import type { Dependencies } from "../../../application/ports/dependencies";
import { BusinessAccess } from "../../../application/services/business-access";
import {
  BookAppointment,
  GetBookingPage,
  GetBusinessHours,
  ListAvailableSlots,
  ManageBookingLink,
  SaveBusinessHours,
} from "../../../application/use-cases/booking";
import { formatTime } from "../../../domain/scheduling/availability";
import { serializeAppointment } from "../mappers/serializers";
import { userIdOf } from "../middleware/identity";
import { parse } from "../validators/parse";
import {
  bookingParamSchema,
  bookingRequestSchema,
  businessHoursSchema,
  businessParamSchema,
  slotsQuerySchema,
} from "../validators/schemas";

/**
 * Agenda pública.
 *
 * As três primeiras rotas são abertas: quem entra é a cliente, com o link na
 * mão e sem conta no BeautyConta. Por isso elas devolvem o mínimo — nome,
 * serviços e horários — e nada que descreva o negócio por dentro.
 */
export class BookingController {
  private readonly access: BusinessAccess;

  constructor(private readonly deps: Dependencies) {
    this.access = new BusinessAccess(deps.businesses, deps.subscriptions);
  }

  page = async (req: Request, res: Response): Promise<void> => {
    const { token } = parse(bookingParamSchema, req.params);

    const page = await new GetBookingPage(this.deps.businesses, this.deps.services).execute(token);
    res.json(page);
  };

  slots = async (req: Request, res: Response): Promise<void> => {
    const { token } = parse(bookingParamSchema, req.params);
    const query = parse(slotsQuerySchema, req.query);

    const availability = await new ListAvailableSlots(
      this.deps.businesses,
      this.deps.businessHours,
      this.deps.services,
      this.deps.appointments,
      this.deps.clock,
    ).execute(token, query.serviceId, query.date);

    res.json(availability);
  };

  book = async (req: Request, res: Response): Promise<void> => {
    const { token } = parse(bookingParamSchema, req.params);
    const input = parse(bookingRequestSchema, req.body);

    const appointment = await new BookAppointment(
      this.deps.businesses,
      this.deps.businessHours,
      this.deps.services,
      this.deps.appointments,
      this.deps.clock,
    ).execute(token, input);

    // A confirmação devolve só o que a cliente precisa ver. O restante do
    // atendimento é dado do negócio, não dela.
    res.status(201).json({
      startsAt: appointment.startsAt.toISOString(),
      durationMinutes: appointment.durationMinutes,
      clientName: appointment.clientName,
    });
  };

  // --- rotas da profissional, com sessão -----------------------------------

  getHours = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);

    const hours = await new GetBusinessHours(this.access, this.deps.businessHours).execute(
      userIdOf(req),
      businessId,
    );

    res.json({ items: hours.map(serializeHour) });
  };

  saveHours = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const input = parse(businessHoursSchema, req.body);

    const hours = await new SaveBusinessHours(this.access, this.deps.businessHours).execute(
      userIdOf(req),
      businessId,
      input.items,
    );

    res.json({ items: hours.map(serializeHour) });
  };

  enableLink = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);

    const business = await new ManageBookingLink(this.access, this.deps.businesses).enable(
      userIdOf(req),
      businessId,
    );

    res.json({ bookingToken: business.bookingToken });
  };

  regenerateLink = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);

    const business = await new ManageBookingLink(this.access, this.deps.businesses).regenerate(
      userIdOf(req),
      businessId,
    );

    res.json({ bookingToken: business.bookingToken });
  };

  disableLink = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);

    await new ManageBookingLink(this.access, this.deps.businesses).disable(
      userIdOf(req),
      businessId,
    );

    res.status(204).end();
  };
}

function serializeHour(hour: { weekday: number; startMinute: number; endMinute: number }) {
  return {
    weekday: hour.weekday,
    start: formatTime(hour.startMinute),
    end: formatTime(hour.endMinute),
  };
}

export { serializeAppointment };
