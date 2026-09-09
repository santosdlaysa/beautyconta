import type { PlanSlug } from "../../domain/billing/plan-limits";
import type {
  ChannelSlug,
  SubscriptionStatusSlug,
} from "../../domain/billing/subscription-access";
import type { BillingPeriodSlug, SubscriptionProviderSlug } from "./records";

/**
 * Portas de cobrança.
 *
 * Elas existem para que a regra da seção 3 do documento 11 seja estrutural: o
 * processador informa, quem decide o acesso é a aplicação. Nenhum caso de uso
 * conhece Mercado Pago ou RevenueCat pelo nome.
 */

export type CheckoutRequest = {
  businessId: string;
  plan: Exclude<PlanSlug, "FREE">;
  billingPeriod: BillingPeriodSlug;
  /** Para onde devolver a assinante ao concluir ou desistir. */
  returnUrl?: string;
};

export type CheckoutSession = {
  provider: SubscriptionProviderSlug;
  channel: ChannelSlug;
  /** Endereço que a assinante abre para pagar. */
  checkoutUrl: string;
  providerSubscriptionId?: string;
};

export interface SubscriptionGateway {
  readonly provider: SubscriptionProviderSlug;
  readonly channel: ChannelSlug;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  /** Cancela no processador. O reflexo em `subscriptions` vem pelo webhook. */
  cancel(providerSubscriptionId: string): Promise<void>;
}

/**
 * O que a aplicação precisa saber de um evento de cobrança, seja qual for o
 * formato do provedor.
 *
 * `externalEventId` é a chave da idempotência. `subscription` vem nulo quando o
 * evento é apenas uma notificação que exige consulta posterior — caso do
 * Mercado Pago, cujo webhook avisa que algo mudou sem dizer o quê.
 */
export type BillingEventTranslation = {
  externalEventId: string;
  type: string;
  businessId: string | null;
  subscription: {
    plan: PlanSlug;
    status: SubscriptionStatusSlug;
    channel: ChannelSlug;
    billingPeriod: BillingPeriodSlug;
    providerSubscriptionId: string;
    providerCustomerId?: string | null;
    revenuecatAppUserId?: string | null;
    mpPreapprovalId?: string | null;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
  } | null;
};

export interface BillingWebhookTranslator {
  readonly provider: SubscriptionProviderSlug;
  /** Recusa o evento devolvendo `null`: assinatura inválida ou formato desconhecido. */
  translate(payload: unknown, headers: Record<string, string | undefined>): BillingEventTranslation | null;
}
