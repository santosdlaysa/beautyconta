/**
 * Regras do painel administrativo que valem a pena verificar sozinhas.
 *
 * Tudo aqui é função pura: entra dado, sai dado. O que fala com a rede mora em
 * `infrastructure/admin`, e o que desenha mora no componente — esta separação é
 * o que permite testar a conversão de dinheiro sem subir servidor nem navegador.
 */

/** Um plano à venda, como o painel o edita. */
export type AdminOffer = {
  plan: "PREMIUM" | "MASTER";
  billingPeriod: "MONTHLY" | "ANNUAL";
  priceCents: number;
  isActive: boolean;
  benefits: string[];
  updatedAt: string;
};

export type AdminOverview = {
  users: { total: number; today: number; last7Days: number; last30Days: number };
  businesses: { total: number; withBookingOpen: number };
  subscriptions: { active: number; byPlan: Record<string, number>; byChannel: Record<string, number> };
  revenue: { monthlyRecurringCents: number };
  usage: { services: number; materials: number; calculations: number; appointments: number };
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  businessName: string | null;
  plan: string;
  createdAt: string;
};

export type AdminSubscription = {
  id: string;
  businessName: string | null;
  ownerEmail: string;
  plan: string;
  status: string;
  channel: string;
  billingPeriod: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

/**
 * Pedido de exclusão de conta feito pelo site.
 *
 * Só chega aqui quem não conseguiu entrar no aplicativo: quem entra apaga a
 * própria conta na hora, sem passar por fila nenhuma.
 */
export type AdminDeletionRequest = {
  id: string;
  email: string;
  note: string | null;
  status: "pending" | "done" | "rejected";
  createdAt: string;
  handledAt: string | null;
};

/**
 * Há quantos dias o pedido espera.
 *
 * Existe porque há prazo legal para responder, e o painel precisa mostrar o que
 * está encostando nele antes que alguém descubra pelo caminho errado.
 */
export function daysWaiting(request: Pick<AdminDeletionRequest, "createdAt">, now: Date = new Date()): number {
  const dias = (now.getTime() - new Date(request.createdAt).getTime()) / 86_400_000;
  return Math.max(0, Math.floor(dias));
}

export const DELETION_STATUS_LABELS: Record<string, string> = {
  pending: "Aguardando",
  done: "Apagada",
  rejected: "Recusado",
};


export type AdminMetrics = {
  leads: { current: number; previous: number };
  payers: { current: number; previous: number };
  churned: number;
  baseAtStart: number;
  revenue: { currentCents: number; previousCents: number };
  ticketCents: number;
  signups: { date: string; count: number }[];
};

export type AdminBusiness = {
  id: string;
  name: string | null;
  ownerName: string;
  ownerEmail: string;
  segment: string;
  workModel: string;
  timezone: string;
  bookingSlug: string | null;
  plan: string;
  createdAt: string;
  counts: { services: number; materials: number; calculations: number; appointments: number };
};

export type AdminActivity = {
  kind: "calculation" | "appointment" | "service";
  businessId: string;
  businessName: string | null;
  label: string;
  at: string;
};

export type AdminBillingEvent = {
  id: string;
  source: string;
  type: string;
  businessId: string | null;
  processedAt: string | null;
  createdAt: string;
};

export type AdminBillingHealth = {
  unprocessed: number;
  last24h: number;
  staleActive: number;
  inGrace: number;
};

export type AdminSettings = {
  billing: { mercadoPago: boolean; checkout: string };
  legal: { termsUrl: string; privacyUrl: string; supportEmail: string };
  admin: { hasSecret: boolean; emails: number };
  seedPrices: number;
};

/**
 * Variação contra o período anterior, em pontos percentuais.
 *
 * `null` quando não havia base para comparar: sair de zero para cinco não é
 * "crescimento de 500%", é a primeira medição — e anunciar percentual aí é o
 * jeito mais fácil de um painel mentir.
 */
export function variation(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Quantas assinaturas se perderam, em percentual da base do início do mês.
 *
 * `null` sem base: dividir por zero daria infinito, e "churn infinito" num
 * produto sem assinantes é ruído, não informação.
 */
export function churnRate(churned: number, baseAtStart: number): number | null {
  if (baseAtStart === 0) return null;
  return Math.round((churned / baseAtStart) * 100);
}

/** Quantos por cento das contas viraram assinantes. */
export function conversionRate(payers: number, leads: number): number | null {
  if (leads === 0) return null;
  return Math.round((payers / leads) * 100);
}

/** `há 2 h`, `há 3 d`. Tempo relativo curto, para caber em tabela. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const minutos = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);

  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;

  return `há ${Math.floor(horas / 24)} d`;
}

export const SEGMENT_LABELS: Record<string, string> = {
  nails: "Unhas",
  lashes: "Cílios",
  brows: "Sobrancelhas",
  hair: "Cabelo",
  esthetics: "Estética",
  makeup: "Maquiagem",
  waxing: "Depilação",
  other: "Outro",
};

export const WORK_MODEL_LABELS: Record<string, string> = {
  home: "Em casa",
  own_salon: "Salão próprio",
  rented_station: "Cadeira alugada",
  shared_space: "Espaço compartilhado",
  mobile: "Atende a domicílio",
};

/**
 * Texto digitado para centavos inteiros.
 *
 * Aceita o que a pessoa realmente escreve num campo de preço: `29,90`, `29.90`,
 * `R$ 29,90`, `1.234,56`. A vírgula é o separador decimal e o ponto é o de
 * milhar, como se escreve no Brasil — trocar os dois transformaria mil e
 * duzentos reais em um real e vinte.
 *
 * `null` quando não dá para ler um número, e nunca zero: zero é um preço
 * válido de digitar e inválido de cobrar, e confundir os dois publicaria uma
 * assinatura de graça.
 */
export function parsePriceToCents(input: string): number | null {
  const limpo = input.replace(/[^\d.,-]/g, "").trim();
  if (!limpo) return null;

  const temVirgula = limpo.includes(",");
  const normalizado = temVirgula
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;

  const reais = Number(normalizado);
  if (!Number.isFinite(reais) || reais < 0) return null;

  return Math.round(reais * 100);
}

/** Centavos para o texto do campo, no formato que a pessoa vai reconhecer. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export const formatCents = (cents: number): string =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Faixa aceita, espelhando o domínio do servidor.
 *
 * A duplicação é consciente e conservadora: quem manda é o servidor, e isto
 * existe só para o painel avisar antes de enviar, em vez de deixar a pessoa
 * descobrir pelo erro.
 */
export const MIN_PRICE_CENTS = 100;
export const MAX_PRICE_CENTS = 100_000;

export function validateOfferPrice(cents: number | null): string | null {
  if (cents === null) return "Digite um valor, como 29,90.";
  if (cents < MIN_PRICE_CENTS) return `O menor preço aceito é ${formatCents(MIN_PRICE_CENTS)}.`;
  if (cents > MAX_PRICE_CENTS) return `O maior preço aceito é ${formatCents(MAX_PRICE_CENTS)}.`;
  return null;
}

/** Rótulos em português, para a tela não mostrar o vocabulário do banco. */
export const PLAN_LABELS: Record<string, string> = {
  FREE: "Gratuito",
  PREMIUM: "Premium",
  MASTER: "Master",
};

export const PERIOD_LABELS: Record<string, string> = {
  MONTHLY: "Mensal",
  ANNUAL: "Anual",
};

export const CHANNEL_LABELS: Record<string, string> = {
  WEB: "Site",
  ANDROID: "Google Play",
  IOS: "App Store",
};

export const STATUS_LABELS: Record<string, string> = {
  active: "Ativa",
  in_grace: "Em carência",
  past_due: "Cobrança falhou",
  canceled: "Cancelada",
  expired: "Expirada",
  refunded: "Reembolsada",
  paused: "Pausada",
};

/**
 * Como a situação de uma assinatura deve aparecer.
 *
 * `canceled` com período em aberto ainda dá acesso — e mostrar "cancelada" em
 * vermelho aí assustaria à toa: a assinante segue com o plano até a data.
 */
export function subscriptionTone(
  subscription: Pick<AdminSubscription, "status" | "cancelAtPeriodEnd" | "currentPeriodEnd">,
  now: Date = new Date(),
): "ok" | "warn" | "off" {
  const emAberto =
    subscription.currentPeriodEnd === null || new Date(subscription.currentPeriodEnd) > now;

  if (subscription.status === "active" && !subscription.cancelAtPeriodEnd) return "ok";
  if ((subscription.status === "active" || subscription.status === "in_grace") && emAberto) {
    return "warn";
  }
  return "off";
}
