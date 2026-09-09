import { timingSafeEqual } from "node:crypto";
import type { PlanSlug } from "../../../domain/billing/plan-limits";
import type {
  ChannelSlug,
  SubscriptionStatusSlug,
} from "../../../domain/billing/subscription-access";
import type {
  BillingEventTranslation,
  BillingWebhookTranslator,
} from "../../../application/ports/billing";
import type { BillingPeriodSlug } from "../../../application/ports/records";

type RevenueCatEvent = {
  id?: unknown;
  type?: unknown;
  app_user_id?: unknown;
  original_app_user_id?: unknown;
  product_id?: unknown;
  period_type?: unknown;
  store?: unknown;
  purchased_at_ms?: unknown;
  expiration_at_ms?: unknown;
  cancel_reason?: unknown;
  original_transaction_id?: unknown;
  transaction_id?: unknown;
  environment?: unknown;
};

/**
 * Estado da assinatura por tipo de evento do RevenueCat.
 *
 * `CANCELLATION` vira `active` com `cancelAtPeriodEnd`, e não `canceled`:
 * cancelar a renovação não encerra o período já pago. Quem encerra é
 * `EXPIRATION`. Tratar cancelamento como perda imediata de acesso tiraria da
 * assinante dias que ela pagou.
 */
const STATUS_BY_TYPE: Record<string, { status: SubscriptionStatusSlug; cancelAtPeriodEnd: boolean }> = {
  INITIAL_PURCHASE: { status: "active", cancelAtPeriodEnd: false },
  RENEWAL: { status: "active", cancelAtPeriodEnd: false },
  UNCANCELLATION: { status: "active", cancelAtPeriodEnd: false },
  PRODUCT_CHANGE: { status: "active", cancelAtPeriodEnd: false },
  NON_RENEWING_PURCHASE: { status: "active", cancelAtPeriodEnd: true },
  CANCELLATION: { status: "active", cancelAtPeriodEnd: true },
  BILLING_ISSUE: { status: "in_grace", cancelAtPeriodEnd: false },
  SUBSCRIPTION_PAUSED: { status: "paused", cancelAtPeriodEnd: false },
  EXPIRATION: { status: "expired", cancelAtPeriodEnd: true },
  TRANSFER: { status: "active", cancelAtPeriodEnd: false },
};

const CHANNEL_BY_STORE: Record<string, ChannelSlug> = {
  PLAY_STORE: "ANDROID",
  APP_STORE: "IOS",
  MAC_APP_STORE: "IOS",
  AMAZON: "ANDROID",
  STRIPE: "WEB",
  PROMOTIONAL: "WEB",
};

export type ProductPlanMap = ReadonlyArray<{
  productId: string;
  plan: Exclude<PlanSlug, "FREE">;
  billingPeriod: BillingPeriodSlug;
}>;

/**
 * Tradutor do webhook do RevenueCat, item F-03.
 *
 * O `app_user_id` enviado ao RevenueCat é o identificador do negócio, nunca o
 * e-mail — exigência explícita do backlog e da política de dados pessoais.
 */
export class RevenueCatTranslator implements BillingWebhookTranslator {
  readonly provider = "REVENUECAT" as const;

  constructor(
    private readonly productMap: ProductPlanMap,
    /** Valor combinado no painel do RevenueCat; sem ele, nada é aceito. */
    private readonly authorizationToken: string | null,
    /**
     * Aceitar compra de ambiente de teste. Falso em produção: o RevenueCat
     * entrega evento de sandbox no mesmo webhook, com o mesmo cabeçalho, e uma
     * compra de teste que conceda plano pago não é forja — é evento verdadeiro
     * do ambiente errado.
     */
    private readonly acceptSandbox = false,
  ) {}

  translate(
    payload: unknown,
    headers: Record<string, string | undefined>,
  ): BillingEventTranslation | null {
    if (!this.isAuthorized(headers)) return null;

    const event = (payload as { event?: RevenueCatEvent } | null)?.event;
    if (!event || typeof event.id !== "string" || typeof event.type !== "string") return null;

    const businessId =
      typeof event.app_user_id === "string"
        ? event.app_user_id
        : typeof event.original_app_user_id === "string"
          ? event.original_app_user_id
          : null;

    // Evento de teste é gravado como qualquer outro, para não perder a trilha,
    // mas nunca toca em `subscriptions`.
    const isSandbox =
      typeof event.environment === "string" && event.environment.toUpperCase() !== "PRODUCTION";

    if (isSandbox && !this.acceptSandbox) {
      return { externalEventId: event.id, type: event.type, businessId, subscription: null };
    }

    const mapping = STATUS_BY_TYPE[event.type];
    const product = this.productMap.find((item) => item.productId === event.product_id);
    const providerSubscriptionId =
      typeof event.original_transaction_id === "string"
        ? event.original_transaction_id
        : typeof event.transaction_id === "string"
          ? event.transaction_id
          : null;

    // Evento reconhecido mas sem produto mapeado, sem negócio ou sem
    // identificador de assinatura: grava o bruto e não mexe no acesso.
    if (!mapping || !product || !businessId || !providerSubscriptionId) {
      return { externalEventId: event.id, type: event.type, businessId, subscription: null };
    }

    const store = typeof event.store === "string" ? event.store : "";

    return {
      externalEventId: event.id,
      type: event.type,
      businessId,
      subscription: {
        plan: product.plan,
        status: mapping.status,
        channel: CHANNEL_BY_STORE[store] ?? "ANDROID",
        billingPeriod: product.billingPeriod,
        providerSubscriptionId,
        revenuecatAppUserId: businessId,
        currentPeriodStart: toDate(event.purchased_at_ms),
        currentPeriodEnd: toDate(event.expiration_at_ms),
        cancelAtPeriodEnd: mapping.cancelAtPeriodEnd,
      },
    };
  }

  private isAuthorized(headers: Record<string, string | undefined>): boolean {
    if (!this.authorizationToken) return false;

    const received = Buffer.from(headers["authorization"] ?? "", "utf8");
    const expected = Buffer.from(this.authorizationToken, "utf8");

    // Mesma comparação em tempo constante que o tradutor do Mercado Pago já
    // usa. O ganho prático é pequeno; a inconsistência é que não se justifica.
    return received.length === expected.length && timingSafeEqual(received, expected);
  }
}

function toDate(value: unknown): Date | null {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value) : null;
}
