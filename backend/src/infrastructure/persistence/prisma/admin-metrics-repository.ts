import type { PrismaClient } from "@prisma/client";
import type {
  AdminActivityItem,
  AdminBillingEvent,
  AdminBillingHealth,
  AdminBusinessMetrics,
  AdminBusinessSummary,
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


  /**
   * Funil e receita do mês, contra o mês anterior.
   *
   * A comparação com o mês anterior é o que dá sentido ao número: "12 novas
   * assinantes" não diz nada sozinho, e diz tudo ao lado de "4 no mês passado".
   */
  async businessMetrics(now: Date): Promise<AdminBusinessMetrics> {
    const inicioMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const inicioAnterior = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

    const vivo = { deletedAt: null };
    const doNegocio = { business: { owner: vivo } };

    const [leadsAtual, leadsAnterior, assinaturas, offers] = await Promise.all([
      this.prisma.user.count({ where: { ...vivo, createdAt: { gte: inicioMes } } }),
      this.prisma.user.count({
        where: { ...vivo, createdAt: { gte: inicioAnterior, lt: inicioMes } },
      }),
      this.prisma.subscription.findMany({
        where: doNegocio,
        select: {
          plan: true,
          status: true,
          billingPeriod: true,
          currentPeriodEnd: true,
          createdAt: true,
        },
      }),
      this.prisma.planOffer.findMany(),
    ]);

    const preco = new Map(offers.map((offer) => [`${offer.plan}:${offer.billingPeriod}`, offer.priceCents]));
    const mensalDe = (assinatura: { plan: string; billingPeriod: string }) => {
      const valor = preco.get(`${assinatura.plan}:${assinatura.billingPeriod}`) ?? 0;
      // A anual entra dividida por doze: somar o valor cheio no mês da compra
      // faria o número saltar e despencar sem nada ter mudado no negócio.
      return assinatura.billingPeriod === "ANNUAL" ? Math.round(valor / 12) : valor;
    };

    const ativa = (item: (typeof assinaturas)[number], quando: Date) =>
      (item.status === "active" || item.status === "in_grace") &&
      item.createdAt <= quando &&
      (item.currentPeriodEnd === null || item.currentPeriodEnd > quando);

    const ativasAgora = assinaturas.filter((item) => ativa(item, now));
    const receitaAtual = ativasAgora.reduce((soma, item) => soma + mensalDe(item), 0);
    const receitaAnterior = assinaturas
      .filter((item) => ativa(item, inicioMes))
      .reduce((soma, item) => soma + mensalDe(item), 0);

    return {
      leads: { current: leadsAtual, previous: leadsAnterior },
      payers: {
        current: assinaturas.filter((item) => item.createdAt >= inicioMes).length,
        previous: assinaturas.filter(
          (item) => item.createdAt >= inicioAnterior && item.createdAt < inicioMes,
        ).length,
      },
      churned: assinaturas.filter(
        (item) =>
          item.currentPeriodEnd !== null &&
          item.currentPeriodEnd >= inicioMes &&
          item.currentPeriodEnd < now,
      ).length,
      baseAtStart: assinaturas.filter((item) => ativa(item, inicioMes)).length,
      revenue: { currentCents: receitaAtual, previousCents: receitaAnterior },
      ticketCents:
        ativasAgora.length === 0 ? 0 : Math.round(receitaAtual / ativasAgora.length),
    };
  }

  /**
   * Cadastros por dia.
   *
   * Devolve **todos** os dias do intervalo, inclusive os de zero: um gráfico que
   * pula os dias vazios comprime o tempo e faz uma semana morta parecer
   * movimento contínuo.
   */
  async signupSeries(now: Date, days: number): Promise<{ date: string; count: number }[]> {
    const inicio = new Date(now.getTime() - (days - 1) * 86_400_000);
    inicio.setUTCHours(0, 0, 0, 0);

    const usuarias = await this.prisma.user.findMany({
      where: { deletedAt: null, createdAt: { gte: inicio } },
      select: { createdAt: true },
    });

    const porDia = new Map<string, number>();
    for (const usuaria of usuarias) {
      const dia = usuaria.createdAt.toISOString().slice(0, 10);
      porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
    }

    return Array.from({ length: days }, (_, index) => {
      const data = new Date(inicio.getTime() + index * 86_400_000).toISOString().slice(0, 10);
      return { date: data, count: porDia.get(data) ?? 0 };
    });
  }

  async listBusinesses(options: { search?: string; limit: number; offset: number }): Promise<{
    items: AdminBusinessSummary[];
    total: number;
  }> {
    const busca = options.search?.trim();
    const where = {
      owner: { deletedAt: null },
      ...(busca
        ? {
            OR: [
              { name: { contains: busca, mode: "insensitive" as const } },
              { owner: { email: { contains: busca, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.business.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: options.limit,
        skip: options.offset,
        include: {
          owner: { select: { name: true, email: true } },
          subscriptions: true,
          _count: {
            select: { services: true, materials: true, calculations: true, appointments: true },
          },
        },
      }),
      this.prisma.business.count({ where }),
    ]);

    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        ownerName: row.owner.name,
        ownerEmail: row.owner.email,
        segment: row.primaryCategory,
        workModel: row.workModel,
        timezone: row.timezone,
        bookingSlug: row.bookingSlug,
        plan: effectivePlan(row.subscriptions),
        createdAt: row.createdAt,
        counts: {
          services: row._count.services,
          materials: row._count.materials,
          calculations: row._count.calculations,
          appointments: row._count.appointments,
        },
      })),
    };
  }

  /**
   * O que aconteceu de mais recente no produto.
   *
   * Serve para responder "alguém está usando isto?" sem abrir conta por conta.
   * Traz o rótulo pronto, e nunca o conteúdo do cadastro: o painel precisa saber
   * que houve um cálculo, não quanto custa o serviço de alguém.
   */
  async recentActivity(limit: number): Promise<AdminActivityItem[]> {
    const doNegocio = { business: { owner: { deletedAt: null } } };
    const comNome = { business: { select: { id: true, name: true } } };

    const [calculos, agendamentos, servicos] = await Promise.all([
      this.prisma.pricingCalculation.findMany({
        where: doNegocio,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: comNome,
      }),
      this.prisma.appointment.findMany({
        where: doNegocio,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: comNome,
      }),
      this.prisma.service.findMany({
        where: doNegocio,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: comNome,
      }),
    ]);

    const itens: AdminActivityItem[] = [
      ...calculos.map((item) => ({
        kind: "calculation" as const,
        businessId: item.business.id,
        businessName: item.business.name,
        label: "Calculou um preço",
        at: item.createdAt,
      })),
      ...agendamentos.map((item) => ({
        kind: "appointment" as const,
        businessId: item.business.id,
        businessName: item.business.name,
        label: "Recebeu um agendamento",
        at: item.createdAt,
      })),
      ...servicos.map((item) => ({
        kind: "service" as const,
        businessId: item.business.id,
        businessName: item.business.name,
        label: "Cadastrou um serviço",
        at: item.createdAt,
      })),
    ];

    return itens.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
  }

  async listBillingEvents(options: {
    limit: number;
    onlyUnprocessed?: boolean;
  }): Promise<AdminBillingEvent[]> {
    const rows = await this.prisma.billingEvent.findMany({
      ...(options.onlyUnprocessed ? { where: { processedAt: null } } : {}),
      orderBy: { createdAt: "desc" },
      take: options.limit,
      select: {
        id: true,
        source: true,
        type: true,
        businessId: true,
        processedAt: true,
        createdAt: true,
      },
    });

    return rows;
  }

  /**
   * Sinais de que a cobrança está falhando em silêncio.
   *
   * Cada número aqui existe porque o defeito correspondente não aparece em
   * lugar nenhum: evento não processado é um acesso que devia ter mudado e não
   * mudou, e assinatura vencida ainda marcada como ativa é plano pago que
   * alguém continua usando de graça.
   */
  async billingHealth(now: Date): Promise<AdminBillingHealth> {
    const [unprocessed, last24h, staleActive, inGrace] = await Promise.all([
      this.prisma.billingEvent.count({ where: { processedAt: null } }),
      this.prisma.billingEvent.count({
        where: { createdAt: { gte: new Date(now.getTime() - 86_400_000) } },
      }),
      this.prisma.subscription.count({
        where: { status: "active", currentPeriodEnd: { lt: now } },
      }),
      this.prisma.subscription.count({ where: { status: "in_grace" } }),
    ]);

    return { unprocessed, last24h, staleActive, inGrace };
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
