import type { PlanSlug } from "./plan-limits";

export type SubscriptionStatusSlug =
  | "active"
  | "in_grace"
  | "past_due"
  | "canceled"
  | "expired"
  | "refunded"
  | "paused";

export type ChannelSlug = "WEB" | "ANDROID" | "IOS";

export type SubscriptionSnapshot = {
  plan: PlanSlug;
  status: SubscriptionStatusSlug;
  channel: ChannelSlug;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

/**
 * Status que ainda dão acesso ao plano pago.
 *
 * `in_grace` é o período de carência da cobrança falhada: a assinante continua
 * usando enquanto o processador tenta de novo. `past_due` já esgotou as
 * tentativas e cai para o gratuito sem apagar nada.
 */
export const GRANTS_ACCESS: ReadonlySet<SubscriptionStatusSlug> = new Set([
  "active",
  "in_grace",
]);

export function grantsAccess(status: SubscriptionStatusSlug): boolean {
  return GRANTS_ACCESS.has(status);
}

/**
 * Plano em vigor para o negócio. É esta função — e não o processador, nem o SDK
 * da loja — que decide o que a assinante pode usar, conforme a seção 3 do
 * documento 11.
 *
 * A degradação para `FREE` é sempre silenciosa quanto aos dados: perde-se o
 * recurso, nunca o cadastro.
 */
export function effectivePlan(
  subscriptions: readonly SubscriptionSnapshot[],
  now: Date = new Date(),
): PlanSlug {
  const ranking: PlanSlug[] = ["MASTER", "PREMIUM"];

  for (const plan of ranking) {
    const active = subscriptions.some(
      (subscription) =>
        subscription.plan === plan &&
        grantsAccess(subscription.status) &&
        (subscription.currentPeriodEnd === null || subscription.currentPeriodEnd > now),
    );
    if (active) return plan;
  }

  return "FREE";
}

/**
 * Assinatura ativa em outro canal, se houver.
 *
 * Serve à regra da seção 4 do documento 11: antes de abrir qualquer checkout, o
 * servidor verifica se já existe cobrança em andamento em outro lugar, porque o
 * BeautyConta não consegue cancelar uma assinatura da App Store.
 */
export function activeSubscriptionInAnotherChannel(
  subscriptions: readonly SubscriptionSnapshot[],
  channel: ChannelSlug,
): SubscriptionSnapshot | undefined {
  return subscriptions.find(
    (subscription) => subscription.channel !== channel && grantsAccess(subscription.status),
  );
}
