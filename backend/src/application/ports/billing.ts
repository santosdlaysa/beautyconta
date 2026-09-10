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

/**
 * Como a assinante quer pagar.
 *
 * A diferença não é cosmética: **`card` renova sozinho, `pix` não.** O Mercado
 * Pago só faz cobrança recorrente automática no cartão; Pix é pagamento avulso,
 * e nenhum arranjo muda isso. Quem paga por Pix compra um período que termina, e
 * a assinatura nasce marcada para não renovar.
 */
export type PaymentMethodSlug = "card" | "pix";

export type CheckoutRequest = {
  businessId: string;
  plan: Exclude<PlanSlug, "FREE">;
  billingPeriod: BillingPeriodSlug;
  /** Preço em centavos inteiros, do catálogo de ofertas (ADR-0002). */
  priceCents: number;
  paymentMethod: PaymentMethodSlug;
  /** Para onde devolver a assinante ao concluir ou desistir. */
  returnUrl?: string;
};

export type CheckoutSession = {
  provider: SubscriptionProviderSlug;
  channel: ChannelSlug;
  /** Endereço que a assinante abre para pagar. */
  checkoutUrl: string;
  providerSubscriptionId?: string;
  /**
   * Como será pago, ecoado para a tela saber o que dizer: Pix compra um período
   * que termina, e a tela precisa avisar isso antes, não depois.
   */
  paymentMethod?: PaymentMethodSlug;
};

export interface SubscriptionGateway {
  readonly provider: SubscriptionProviderSlug;
  readonly channel: ChannelSlug;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  /** Cancela no processador. O reflexo em `subscriptions` vem pelo webhook. */
  cancel(providerSubscriptionId: string): Promise<void>;
}

/**
 * Consulta ao provedor para descobrir o que uma notificação significa.
 *
 * Existe por causa do Mercado Pago: o webhook dele avisa que algo mudou sem
 * dizer o quê, e só uma consulta autenticada revela o estado real. O RevenueCat
 * manda o estado no próprio evento e não precisa disto — por isso a porta é
 * separada da do tradutor, e opcional.
 */
export interface BillingStateResolver {
  readonly provider: SubscriptionProviderSlug;
  /**
   * `null` quando a notificação não diz respeito a nenhuma assinatura que
   * conheçamos — um pagamento avulso de outra origem, por exemplo. O evento
   * continua gravado; o que não acontece é a alteração de acesso.
   */
  resolve(reference: BillingReference): Promise<ResolvedSubscription | null>;
}

/** O que a notificação aponta: o tipo do recurso e o identificador dele. */
export type BillingReference = {
  /** `payment`, `preapproval`, `subscription_preapproval`... como veio. */
  type: string;
  externalId: string;
};

export type ResolvedSubscription = {
  businessId: string;
  subscription: TranslatedSubscription;
};

/**
 * O que a aplicação precisa saber de um evento de cobrança, seja qual for o
 * formato do provedor.
 *
 * `externalEventId` é a chave da idempotência. `subscription` vem nulo quando o
 * evento é apenas uma notificação que exige consulta posterior — caso do
 * Mercado Pago, cujo webhook avisa que algo mudou sem dizer o quê.
 */
export type TranslatedSubscription = {
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
};

export type BillingEventTranslation = {
  externalEventId: string;
  type: string;
  businessId: string | null;
  subscription: TranslatedSubscription | null;
  /**
   * O que a notificação aponta, para quem souber consultar.
   *
   * Preenchido quando `subscription` é nulo e o estado real depende de uma
   * consulta ao provedor. Sem isto, a notificação do Mercado Pago era gravada e
   * morria ali: o identificador do recurso não sobrevivia à tradução.
   */
  reference?: BillingReference;
};

export interface BillingWebhookTranslator {
  readonly provider: SubscriptionProviderSlug;
  /** Recusa o evento devolvendo `null`: assinatura inválida ou formato desconhecido. */
  translate(payload: unknown, headers: Record<string, string | undefined>): BillingEventTranslation | null;
}
