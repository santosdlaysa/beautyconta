import type { Request, Response } from "express";
import type { Dependencies } from "../../../application/ports/dependencies";
import {
  DeletePlanOffer,
  GetAdminOverview,
  GetBillingLog,
  GetBusinessMetrics,
  GetRecentActivity,
  ListAdminBusinesses,
  GetAdminUser,
  ListAdminSubscriptions,
  ListAdminUsers,
  ListPlanOffers,
  SavePlanOffer,
} from "../../../application/use-cases/admin";
import { PLAN_LIMITS } from "../../../domain/billing/plan-limits";
import { serializeSubscription } from "../mappers/serializers";
import { parse } from "../validators/parse";
import {
  adminUserParamSchema,
  listAdminQuerySchema,
  planOfferParamSchema,
  planOfferSchema,
} from "../validators/schemas";

/**
 * Painel administrativo.
 *
 * As respostas seguem a convenção da API: dinheiro em centavos inteiros, com o
 * sufixo `Cents`. Formatar aqui pouparia uma linha no painel e criaria duas
 * verdades sobre o mesmo valor.
 */
export class AdminController {
  constructor(private readonly deps: Dependencies) {}

  overview = async (_req: Request, res: Response): Promise<void> => {
    const dados = await new GetAdminOverview(this.deps.adminMetrics).execute(this.deps.clock.now());
    res.json(dados);
  };

  listOffers = async (_req: Request, res: Response): Promise<void> => {
    const offers = await new ListPlanOffers(this.deps.planOffers).execute();

    res.json({
      offers: offers.map(serializeOffer),
      // A mesma tabela que o servidor aplica ao recusar um cadastro: o painel
      // nunca deve prometer um teto diferente do que a API impõe.
      limits: PLAN_LIMITS,
    });
  };

  saveOffer = async (req: Request, res: Response): Promise<void> => {
    const input = parse(planOfferSchema, req.body);

    const offer = await new SavePlanOffer(this.deps.planOffers).execute(input);

    res.status(200).json(serializeOffer(offer));
  };

  deleteOffer = async (req: Request, res: Response): Promise<void> => {
    const { plan, billingPeriod } = parse(planOfferParamSchema, req.params);

    await new DeletePlanOffer(this.deps.planOffers).execute(plan, billingPeriod);

    res.status(204).end();
  };


  metrics = async (_req: Request, res: Response): Promise<void> => {
    const dados = await new GetBusinessMetrics(this.deps.adminMetrics).execute(
      this.deps.clock.now(),
    );

    res.json(dados);
  };

  listBusinesses = async (req: Request, res: Response): Promise<void> => {
    const query = parse(listAdminQuerySchema, req.query);

    const { items, total } = await new ListAdminBusinesses(this.deps.adminMetrics).execute(query);

    res.json({
      total,
      items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    });
  };

  activity = async (_req: Request, res: Response): Promise<void> => {
    const items = await new GetRecentActivity(this.deps.adminMetrics).execute();

    res.json({ items: items.map((item) => ({ ...item, at: item.at.toISOString() })) });
  };

  billingLog = async (req: Request, res: Response): Promise<void> => {
    const { events, health } = await new GetBillingLog(this.deps.adminMetrics).execute(
      this.deps.clock.now(),
      { onlyUnprocessed: req.query.unprocessed === "true" },
    );

    res.json({
      health,
      events: events.map((event) => ({
        ...event,
        processedAt: event.processedAt?.toISOString() ?? null,
        createdAt: event.createdAt.toISOString(),
      })),
    });
  };

  /**
   * O que está ligado neste servidor.
   *
   * **Nenhum segredo sai daqui** — só se cada integração tem credencial ou não.
   * É a diferença entre um painel que ajuda a diagnosticar e um que entrega as
   * chaves a quem conseguir abri-lo.
   */
  settings = (_req: Request, res: Response): void => {
    const { plans, admin } = this.deps;

    res.json({
      billing: {
        mercadoPago: this.deps.billingResolver !== null,
        checkout: this.deps.gateway.provider,
      },
      legal: { termsUrl: plans.termsUrl, privacyUrl: plans.privacyUrl, supportEmail: plans.supportEmail },
      admin: { hasSecret: admin.secret !== null, emails: admin.emails.length },
      seedPrices: plans.prices.length,
    });
  };

  listUsers = async (req: Request, res: Response): Promise<void> => {
    const query = parse(listAdminQuerySchema, req.query);

    const { items, total } = await new ListAdminUsers(this.deps.adminMetrics).execute(query);

    res.json({
      total,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        email: item.email,
        businessName: item.businessName,
        plan: item.plan,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  };

  getUser = async (req: Request, res: Response): Promise<void> => {
    const { id } = parse(adminUserParamSchema, req.params);

    const user = await new GetAdminUser(this.deps.adminMetrics).execute(id);

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      createdAt: user.createdAt.toISOString(),
      businesses: user.businesses.map((business) => ({
        ...business,
        subscriptions: business.subscriptions.map(serializeSubscription),
      })),
    });
  };

  listSubscriptions = async (req: Request, res: Response): Promise<void> => {
    const query = parse(listAdminQuerySchema, req.query);

    const { items, total } = await new ListAdminSubscriptions(this.deps.adminMetrics).execute(query);

    res.json({
      total,
      items: items.map((item) => ({
        ...item,
        currentPeriodEnd: item.currentPeriodEnd?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  };
}

function serializeOffer(offer: {
  plan: string;
  billingPeriod: string;
  priceCents: number;
  isActive: boolean;
  benefits: string[];
  updatedAt: Date;
}) {
  return {
    plan: offer.plan,
    billingPeriod: offer.billingPeriod,
    priceCents: offer.priceCents,
    isActive: offer.isActive,
    benefits: offer.benefits,
    updatedAt: offer.updatedAt.toISOString(),
  };
}
