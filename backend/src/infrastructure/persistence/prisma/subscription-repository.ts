import { Prisma, type BillingEvent, type PrismaClient, type Subscription } from "@prisma/client";
import type { PlanSlug } from "../../../domain/billing/plan-limits";
import type {
  ChannelSlug,
  SubscriptionStatusSlug,
} from "../../../domain/billing/subscription-access";
import type {
  BillingEventRepository,
  SubscriptionRepository,
} from "../../../application/ports/repositories";
import type {
  BillingEventRecord,
  BillingPeriodSlug,
  SubscriptionProviderSlug,
  SubscriptionRecord,
} from "../../../application/ports/records";

export class PrismaSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByBusiness(businessId: string): Promise<SubscriptionRecord[]> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { businessId },
      orderBy: { createdAt: "asc" },
    });
    return subscriptions.map(toRecord);
  }

  async findByProviderSubscriptionId(
    provider: SubscriptionProviderSlug,
    providerSubscriptionId: string,
  ): Promise<SubscriptionRecord | null> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { provider_providerSubscriptionId: { provider, providerSubscriptionId } },
    });
    return subscription ? toRecord(subscription) : null;
  }

  /**
   * O par (provedor, id da assinatura) é único no banco. Usar `upsert` sobre
   * ele é o que torna o reprocessamento de um webhook inofensivo.
   */
  async upsertByProviderSubscriptionId(
    input: Omit<SubscriptionRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<SubscriptionRecord> {
    if (!input.providerSubscriptionId) {
      throw new Error("Assinatura sem identificador do provedor não pode ser gravada.");
    }

    const data = {
      businessId: input.businessId,
      plan: input.plan,
      status: input.status,
      channel: input.channel,
      provider: input.provider,
      billingPeriod: input.billingPeriod,
      providerCustomerId: input.providerCustomerId,
      providerSubscriptionId: input.providerSubscriptionId,
      revenuecatAppUserId: input.revenuecatAppUserId,
      mpPreapprovalId: input.mpPreapprovalId,
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
    };

    return toRecord(
      await this.prisma.subscription.upsert({
        where: {
          provider_providerSubscriptionId: {
            provider: input.provider,
            providerSubscriptionId: input.providerSubscriptionId,
          },
        },
        create: data,
        update: data,
      }),
    );
  }

  async update(
    id: string,
    input: Partial<Omit<SubscriptionRecord, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<SubscriptionRecord> {
    return toRecord(await this.prisma.subscription.update({ where: { id }, data: input }));
  }
}

export class PrismaBillingEventRepository implements BillingEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * A idempotência é do banco, não da aplicação: a corrida entre dois reenvios
   * simultâneos do mesmo evento é resolvida pelo índice único, e o perdedor
   * recebe P2002 e devolve `null`.
   */
  async recordIfNew(
    input: Omit<BillingEventRecord, "id" | "createdAt" | "processedAt">,
  ): Promise<BillingEventRecord | null> {
    try {
      const event = await this.prisma.billingEvent.create({
        data: {
          businessId: input.businessId,
          subscriptionId: input.subscriptionId,
          source: input.source,
          externalEventId: input.externalEventId,
          type: input.type,
          payload: input.payload as Prisma.InputJsonValue,
        },
      });
      return toEventRecord(event);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return null;
      }
      throw error;
    }
  }

  async findByExternalEventId(
    source: BillingEventRecord["source"],
    externalEventId: string,
  ): Promise<BillingEventRecord | null> {
    const event = await this.prisma.billingEvent.findUnique({ where: { externalEventId } });
    return event && event.source === source ? toEventRecord(event) : null;
  }

  async markProcessed(id: string, processedAt: Date): Promise<void> {
    await this.prisma.billingEvent.update({ where: { id }, data: { processedAt } });
  }
}

function toRecord(subscription: Subscription): SubscriptionRecord {
  return {
    id: subscription.id,
    businessId: subscription.businessId,
    plan: subscription.plan as PlanSlug,
    status: subscription.status as SubscriptionStatusSlug,
    channel: subscription.channel as ChannelSlug,
    provider: subscription.provider as SubscriptionProviderSlug,
    billingPeriod: subscription.billingPeriod as BillingPeriodSlug,
    providerCustomerId: subscription.providerCustomerId,
    providerSubscriptionId: subscription.providerSubscriptionId,
    revenuecatAppUserId: subscription.revenuecatAppUserId,
    mpPreapprovalId: subscription.mpPreapprovalId,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}

function toEventRecord(event: BillingEvent): BillingEventRecord {
  return {
    id: event.id,
    businessId: event.businessId,
    subscriptionId: event.subscriptionId,
    source: event.source as SubscriptionProviderSlug,
    externalEventId: event.externalEventId,
    type: event.type,
    payload: event.payload,
    processedAt: event.processedAt,
    createdAt: event.createdAt,
  };
}
