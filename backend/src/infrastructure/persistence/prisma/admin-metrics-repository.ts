import type { PrismaClient } from "@prisma/client";
import type {
  AdminMetricsRepository,
  AdminOverview,
  AdminSubscriptionSummary,
  AdminUserDetail,
  AdminUserSummary,
} from "../../../application/ports/repositories";
import { effectivePlan } from "../../../domain/billing/subscription-access";

/**
 * Leituras do painel administrativo.
 *
 * Duas regras valem para tudo aqui:
 *
 * 1. **conta apagada não aparece.** A exclusão do `RF-01` é uma promessa: uma
 *    conta removida que continuasse listada no painel tornaria a promessa
 *    falsa, mesmo que o dado tenha ficado só para uso interno;
 * 2. **o plano em vigor sai do domínio**, por `effectivePlan`, e não de uma
 *    consulta própria. Duas respostas diferentes para "qual plano é este" é
 *    exatamente o tipo de divergência que faz o painel mentir.
 */
export class PrismaAdminMetricsRepository implements AdminMetricsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async overview(now: Date): Promise<AdminOverview> {
    const hoje = new Date(now);
    hoje.setHours(0, 0, 0, 0);
    const seteDias = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const trintaDias = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

    const vivo = { deletedAt: null };

    const [
      total,
      today,
      last7Days,
      last30Days,
      businesses,
      withBookingOpen,
      subscriptions,
      services,
      materials,
      calculations,
      appointments,
      offers,
    ] = await Promise.all([
      this.prisma.user.count({ where: vivo }),
      this.prisma.user.count({ where: { ...vivo, createdAt: { gte: hoje } } }),
      this.prisma.user.count({ where: { ...vivo, createdAt: { gte: seteDias } } }),
      this.prisma.user.count({ where: { ...vivo, createdAt: { gte: trintaDias } } }),
      this.prisma.business.count({ where: { owner: vivo } }),
      this.prisma.business.count({ where: { owner: vivo, bookingSlug: { not: null } } }),
      this.prisma.subscription.findMany({
        where: { business: { owner: vivo } },
        select: { plan: true, status: true, channel: true, billingPeriod: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
      }),
      this.prisma.service.count({ where: { business: { owner: vivo } } }),
      this.prisma.material.count({ where: { business: { owner: vivo } } }),
      this.prisma.pricingCalculation.count({ where: { business: { owner: vivo } } }),
      this.prisma.appointment.count({ where: { business: { owner: vivo } } }),
      this.prisma.planOffer.findMany({ where: { isActive: true } }),
    ]);

    const ativas = subscriptions.filter(
      (item) =>
        (item.status === "active" || item.status === "in_grace") &&
        (item.currentPeriodEnd === null || item.currentPeriodEnd > now),
    );

    const byPlan: Record<string, number> = {};
    const byChannel: Record<string, number> = {};
    for (const item of ativas) {
      byPlan[item.plan] = (byPlan[item.plan] ?? 0) + 1;
      byChannel[item.channel] = (byChannel[item.channel] ?? 0) + 1;
    }

    /**
     * Receita recorrente mensal.
     *
     * A anual entra dividida por doze, e não pelo valor cheio: somar R$ 299 no
     * mês da compra e zero nos onze seguintes faria o número saltar e despencar
     * sem que nada tivesse mudado no negócio.
     */
    const preco = new Map(offers.map((offer) => [`${offer.plan}:${offer.billingPeriod}`, offer.priceCents]));
    const monthlyRecurringCents = ativas.reduce((soma, item) => {
      const valor = preco.get(`${item.plan}:${item.billingPeriod}`) ?? 0;
      return soma + (item.billingPeriod === "ANNUAL" ? Math.round(valor / 12) : valor);
    }, 0);

    return {
      users: { total, today, last7Days, last30Days },
      businesses: { total: businesses, withBookingOpen },
      subscriptions: { active: ativas.length, byPlan, byChannel },
      revenue: { monthlyRecurringCents },
      usage: { services, materials, calculations, appointments },
    };
  }

  async listUsers(options: { search?: string; limit: number; offset: number }): Promise<{
    items: AdminUserSummary[];
    total: number;
  }> {
    const busca = options.search?.trim();
    const where = {
      deletedAt: null,
      ...(busca
        ? {
            OR: [
              { name: { contains: busca, mode: "insensitive" as const } },
              { email: { contains: busca, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: options.limit,
        skip: options.offset,
        include: {
          businesses: {
            select: { name: true, subscriptions: true },
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      createdAt: row.createdAt,
      businessName: row.businesses[0]?.name ?? null,
      plan: effectivePlan(row.businesses[0]?.subscriptions ?? []),
    }));

    return { items, total };
  }

  async findUser(userId: string): Promise<AdminUserDetail | null> {
    const row = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        businesses: {
          orderBy: { createdAt: "asc" },
          include: {
            subscriptions: { orderBy: { createdAt: "desc" } },
            _count: {
              select: {
                services: true,
                materials: true,
                fixedCosts: true,
                calculations: true,
                appointments: true,
              },
            },
          },
        },
      },
    });

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      createdAt: row.createdAt,
      businessName: row.businesses[0]?.name ?? null,
      plan: effectivePlan(row.businesses[0]?.subscriptions ?? []),
      businesses: row.businesses.map((business) => ({
        id: business.id,
        name: business.name,
        segment: business.primaryCategory,
        timezone: business.timezone,
        bookingSlug: business.bookingSlug,
        counts: {
          services: business._count.services,
          materials: business._count.materials,
          fixedCosts: business._count.fixedCosts,
          calculations: business._count.calculations,
          appointments: business._count.appointments,
        },
        subscriptions: business.subscriptions,
      })),
    };
  }

  async listSubscriptions(options: { limit: number; offset: number }): Promise<{
    items: AdminSubscriptionSummary[];
    total: number;
  }> {
    const where = { business: { owner: { deletedAt: null } } };

    const [rows, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: options.limit,
        skip: options.offset,
        include: { business: { select: { name: true, owner: { select: { email: true } } } } },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    const items = rows.map((row) => ({
      id: row.id,
      businessId: row.businessId,
      businessName: row.business.name,
      ownerEmail: row.business.owner.email,
      plan: row.plan,
      status: row.status,
      channel: row.channel,
      billingPeriod: row.billingPeriod,
      currentPeriodEnd: row.currentPeriodEnd,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      createdAt: row.createdAt,
    }));

    return { items, total };
  }
}
