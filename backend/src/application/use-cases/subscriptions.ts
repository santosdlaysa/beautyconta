import { PLAN_LIMITS, type PlanSlug } from "../../domain/billing/plan-limits";
import {
  activeSubscriptionInAnotherChannel,
  effectivePlan,
} from "../../domain/billing/subscription-access";
import { ConflictError, NotFoundError } from "../errors";
import type {
  BillingWebhookTranslator,
  CheckoutSession,
  SubscriptionGateway,
} from "../ports/billing";
import type {
  BillingEventRepository,
  BusinessRepository,
  Clock,
  SubscriptionRepository,
} from "../ports/repositories";
import type { BillingPeriodSlug, SubscriptionRecord } from "../ports/records";
import type { BusinessAccess } from "../services/business-access";

export type SubscriptionStatusView = {
  plan: PlanSlug;
  limits: (typeof PLAN_LIMITS)[PlanSlug];
  subscriptions: SubscriptionRecord[];
  /** Onde a assinatura é gerenciada e cancelada, exigência da seção 4 do documento 11. */
  managedIn: SubscriptionRecord["channel"] | null;
};

export class GetSubscriptionStatus {
  constructor(
    private readonly access: BusinessAccess,
    private readonly subscriptions: SubscriptionRepository,
  ) {}

  async execute(userId: string, businessId: string): Promise<SubscriptionStatusView> {
    await this.access.authorize(userId, businessId);

    const subscriptions = await this.subscriptions.listByBusiness(businessId);
    const plan = effectivePlan(subscriptions);
    const paid = subscriptions.find(
      (subscription) => subscription.plan === plan && plan !== "FREE",
    );

    return {
      plan,
      limits: PLAN_LIMITS[plan],
      subscriptions,
      managedIn: paid?.channel ?? null,
    };
  }
}

/**
 * Abre o checkout, item F-02.
 *
 * A verificação de canal duplicado acontece antes de qualquer chamada ao
 * processador, como manda a seção 4 do documento 11: pagar duas vezes é um erro
 * que o BeautyConta não consegue desfazer sozinho, porque não cancela
 * assinatura da App Store.
 */
export class StartSubscription {
  constructor(
    private readonly access: BusinessAccess,
    private readonly subscriptions: SubscriptionRepository,
    private readonly gateway: SubscriptionGateway,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    input: { plan: "PREMIUM" | "MASTER"; billingPeriod: BillingPeriodSlug; returnUrl?: string },
  ): Promise<CheckoutSession> {
    await this.access.authorize(userId, businessId);

    const existing = await this.subscriptions.listByBusiness(businessId);
    const elsewhere = activeSubscriptionInAnotherChannel(existing, this.gateway.channel);

    if (elsewhere) {
      throw new ConflictError(
        `Você já tem uma assinatura ativa gerenciada em ${channelLabel(elsewhere.channel)}. ` +
          "Altere ou cancele por lá antes de assinar por aqui.",
      );
    }

    return this.gateway.createCheckout({
      businessId,
      plan: input.plan,
      billingPeriod: input.billingPeriod,
      ...(input.returnUrl !== undefined ? { returnUrl: input.returnUrl } : {}),
    });
  }
}

/**
 * Cancelamento pela própria assinante.
 *
 * O pedido vai ao processador; `subscriptions` só muda quando o webhook
 * confirmar, para que o banco nunca afirme algo que a cobrança não refletiu.
 */
export class CancelSubscription {
  constructor(
    private readonly access: BusinessAccess,
    private readonly subscriptions: SubscriptionRepository,
    private readonly gateway: SubscriptionGateway,
  ) {}

  async execute(userId: string, businessId: string, subscriptionId: string): Promise<void> {
    await this.access.authorize(userId, businessId);

    const all = await this.subscriptions.listByBusiness(businessId);
    const subscription = all.find((item) => item.id === subscriptionId);
    if (!subscription) throw new NotFoundError("Assinatura");

    if (subscription.provider !== this.gateway.provider) {
      throw new ConflictError(
        `Esta assinatura é gerenciada em ${channelLabel(subscription.channel)} e precisa ser cancelada por lá.`,
      );
    }
    if (!subscription.providerSubscriptionId) {
      throw new ConflictError("Esta assinatura ainda não foi confirmada pelo processador.");
    }

    await this.gateway.cancel(subscription.providerSubscriptionId);
  }
}

export type WebhookOutcome =
  | { status: "duplicated" }
  | { status: "rejected" }
  | { status: "recorded"; eventId: string; subscriptionId: string | null };

/**
 * Recebe o webhook de cobrança, item F-02.
 *
 * A ordem importa e não é negociável: grava o evento bruto, só então processa.
 * Se o processamento falhar, o evento já está no banco para ser reprocessado;
 * se o provedor reenviar, `externalEventId` único devolve `duplicated` sem
 * cobrar de novo nem alterar nada.
 */
export class HandleBillingWebhook {
  constructor(
    private readonly events: BillingEventRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly clock: Clock,
    private readonly businesses: BusinessRepository,
  ) {}

  async execute(
    translator: BillingWebhookTranslator,
    payload: unknown,
    headers: Record<string, string | undefined>,
  ): Promise<WebhookOutcome> {
    const translation = translator.translate(payload, headers);
    if (!translation) return { status: "rejected" };

    const knownBusiness =
      translation.businessId !== null &&
      (await this.businesses.findById(translation.businessId)) !== null
        ? translation.businessId
        : null;

    let event = await this.events.recordIfNew({
      businessId: knownBusiness,
      subscriptionId: null,
      source: translator.provider,
      externalEventId: translation.externalEventId,
      type: translation.type,
      payload,
    });

    if (!event) {
      // Já existe. Se ficou sem processar, a reentrega é a chance de terminar:
      // responder "duplicado" aqui faria o provedor desistir de um evento que
      // nunca chegou a alterar a assinatura — uma expiração perdida assim
      // mantém plano pago para sempre, e uma renovação perdida tira o acesso de
      // quem pagou.
      const existing = await this.events.findByExternalEventId(
        translator.provider,
        translation.externalEventId,
      );

      if (!existing || existing.processedAt) return { status: "duplicated" };
      event = existing;
    }

    // O `app_user_id` do RevenueCat é escolhido pelo cliente, então o negócio
    // citado pode não existir — ou pior, ser o de outra pessoa. Sem conferir,
    // um identificador inválido estourava a chave estrangeira e o evento sumia
    // sem trilha, que é o oposto do que este fluxo promete.
    let subscriptionId: string | null = null;

    if (translation.subscription && knownBusiness) {
      const data = translation.subscription;
      const saved = await this.subscriptions.upsertByProviderSubscriptionId({
        businessId: knownBusiness,
        plan: data.plan,
        status: data.status,
        channel: data.channel,
        provider: translator.provider,
        billingPeriod: data.billingPeriod,
        providerCustomerId: data.providerCustomerId ?? null,
        providerSubscriptionId: data.providerSubscriptionId,
        revenuecatAppUserId: data.revenuecatAppUserId ?? null,
        mpPreapprovalId: data.mpPreapprovalId ?? null,
        currentPeriodStart: data.currentPeriodStart ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
      });
      subscriptionId = saved.id;
    }

    await this.events.markProcessed(event.id, this.clock.now());

    return { status: "recorded", eventId: event.id, subscriptionId };
  }
}

function channelLabel(channel: SubscriptionRecord["channel"]): string {
  return { WEB: "site", ANDROID: "Google Play", IOS: "App Store" }[channel];
}
