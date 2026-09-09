import { ApiError, apiRequest } from './api';

/**
 * Recursos da API, um por endpoint.
 *
 * Os tipos aqui espelham os serializadores do servidor: dinheiro em centavos
 * com sufixo `Cents`, percentual em pontos percentuais com sufixo `Percent`. A
 * conversão para reais acontece na tela, nunca no caminho de ida.
 */

export type User = { id: string; name: string; email: string; createdAt: string };
export type Session = { token: string; expiresAt: string; user: User };

export type SegmentSlug = string;
export type Business = {
  id: string;
  name: string | null;
  primaryCategory: SegmentSlug;
  workModel: string;
  currency: string;
  timezone: string;
};

export type AllocationMethod = 'PRODUCTIVE_HOUR' | 'APPOINTMENT';
export type RoundingStrategy = 'NONE' | 'NEAREST_1' | 'NEAREST_5' | 'NEAREST_10' | 'ENDING_90';
export type Settings = {
  businessId: string;
  desiredMonthlyWithdrawalCents: number;
  productiveHoursPerMonth: number;
  estimatedAppointmentsPerMonth: number;
  fixedCostAllocationMethod: AllocationMethod;
  roundingStrategy: RoundingStrategy;
  hourlyRateCents: number | null;
};

export type Material = {
  id: string;
  name: string;
  category: string;
  purchasePriceCents: number;
  purchaseQuantity: number;
  unit: string;
  wastePercent: number;
  unitCostCents: number | null;
  /** Data da compra em `AAAA-MM-DD`, opcional conforme o `RF-03`. */
  purchaseDate: string | null;
  isArchived: boolean;
};

export type FixedCost = {
  id: string;
  name: string;
  category: string;
  monthlyAmountCents: number;
  isActive: boolean;
};

export type ServiceMaterial = { materialId: string; quantityUsed: number };
export type Service = {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  desiredMarginPercent: number;
  currentPriceCents: number | null;
  otherDirectCostCents: number;
  salesFeePercent: number;
  isArchived: boolean;
  materials: ServiceMaterial[];
};

/**
 * Fotografia das entradas guardada com o cálculo (`E-05`).
 *
 * Vem do motor, em reais, e por isso não segue a convenção de centavos do resto
 * do recurso. É o que permite reabrir um cálculo antigo sem recalcular nada.
 */
export type CalculationSnapshot = {
  durationMinutes?: number;
  hourlyRate?: number;
  monthlyFixedCosts?: number;
  monthlyProductiveHours?: number;
  salesFeePercent?: number;
  desiredMarginPercent?: number;
  currentPrice?: number;
  otherDirectCosts?: number;
  materialCost?: number;
  materials?: { purchasePrice: number; purchasedQuantity: number; usedQuantity: number; lossPercent?: number }[];
  allocationMethod?: 'productive_hour' | 'appointment';
  roundingStrategy?: string;
};

export type Calculation = {
  id: string;
  serviceId: string | null;
  calculationVersion: number;
  inputSnapshot: CalculationSnapshot | null;
  materialCostCents: number;
  laborCostCents: number;
  allocatedFixedCostCents: number;
  otherDirectCostCents: number;
  totalBaseCostCents: number;
  minimumPriceCents: number;
  suggestedPriceCents: number;
  commercialPriceCents: number;
  expectedProfitCents: number;
  expectedMarginPercent: number;
  createdAt: string;
};

/** Resultado da calculadora pública, em reais — a exceção documentada da API. */
export type PricingResult = {
  calculationVersion: number;
  materialCost: number;
  laborCost: number;
  allocatedFixedCost: number;
  otherDirectCosts: number;
  totalCost: number;
  minimumPrice: number;
  suggestedPrice: number;
  commercialPrice: number;
  expectedProfit: number;
  expectedMarginPercent: number;
  allocationMethod: 'productive_hour' | 'appointment';
  hourlyRate: number;
  /** Só vêm quando a entrada informa o preço praticado hoje (`RF-08`). */
  currentProfit?: number;
  currentMarginPercent?: number;
};

/** Projeção do simulador de meta. A API insiste: projeção, não garantia. */
export type GoalResult = {
  calculationVersion: number;
  profitPerAppointment: number;
  projectedPrice: number;
  /** `null` quando o preço atual não cobre o custo: nenhum volume alcança a meta. */
  appointmentsNeededAtCurrentPrice: number | null;
  disclaimer: string;
};

export type PlanLimits = {
  materials: number | null;
  services: number | null;
  fixedCosts: number | null;
  calculations: number | null;
};
/** Onde a assinatura foi comprada — e, por isso, onde ela é cancelada. */
export type SubscriptionChannel = 'WEB' | 'ANDROID' | 'IOS';

export type Subscription = {
  id: string;
  plan: string;
  status: string;
  billingPeriod: string;
  channel: SubscriptionChannel;
  provider: string;
  currentPeriodEnd: string | null;
  /** Já pedido: segue valendo até o fim do período pago. */
  cancelAtPeriodEnd: boolean;
};

export type SubscriptionStatus = {
  plan: 'FREE' | 'PREMIUM' | 'MASTER';
  limits: PlanLimits;
  managedIn: SubscriptionChannel | null;
  subscriptions: Subscription[];
};

export type CatalogItem = { slug: string; label: string };
export type Catalog = {
  segments: CatalogItem[];
  workModels: CatalogItem[];
  units: (CatalogItem & { family: string | null })[];
  materialCategories: CatalogItem[];
  fixedCostCategories: CatalogItem[];
  serviceCategories: CatalogItem[];
};

// --- conta e sessão -------------------------------------------------------

export const signUp = (input: { name: string; email: string; password: string }) =>
  apiRequest<Session>('/api/users', { method: 'POST', body: input });

export const signIn = (input: { email: string; password: string }) =>
  apiRequest<Session>('/api/sessions', { method: 'POST', body: input });

export const signOut = (token: string) =>
  apiRequest<void>('/api/sessions/current', { method: 'DELETE', token });

export const getMe = (token: string) => apiRequest<User>('/api/users/me', { token });

export const updateMe = (token: string, input: { name: string }) =>
  apiRequest<User>('/api/users/me', { method: 'PATCH', body: input, token });

export const changePassword = (token: string, input: { currentPassword: string; newPassword: string }) =>
  apiRequest<void>('/api/users/me/password', { method: 'PATCH', body: input, token });

export const deleteAccount = (token: string) =>
  apiRequest<void>('/api/users/me', { method: 'DELETE', token });

// --- negócio --------------------------------------------------------------

/** Listas do servidor vêm embrulhadas em `items`; desembrulhamos na borda. */
const items = async <T>(promise: Promise<{ items: T[] }>): Promise<T[]> => (await promise).items;

export const listBusinesses = (token: string) =>
  items(apiRequest<{ items: Business[] }>('/api/businesses', { token }));

export const createBusiness = (
  token: string,
  input: { name?: string | null; primaryCategory: string; workModel: string },
) => apiRequest<Business>('/api/businesses', { method: 'POST', body: input, token });

export const updateBusiness = (
  token: string,
  businessId: string,
  input: { name?: string | null; primaryCategory?: string; workModel?: string },
) => apiRequest<Business>(`/api/businesses/${businessId}`, { method: 'PATCH', body: input, token });

/**
 * Negócio recém-criado ainda não tem configuração, e o servidor responde 404.
 * Para a interface isso não é erro: é a etapa do onboarding que falta.
 */
export const getSettings = async (token: string, businessId: string): Promise<Settings | null> => {
  try {
    return await apiRequest<Settings>(`/api/businesses/${businessId}/settings`, { token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
};

export const saveSettings = (
  token: string,
  businessId: string,
  input: Omit<Settings, 'businessId' | 'hourlyRateCents'>,
) => apiRequest<Settings>(`/api/businesses/${businessId}/settings`, { method: 'PUT', body: input, token });

// --- cadastros ------------------------------------------------------------

type Scope = { token: string; businessId: string };
const scoped = (businessId: string, path: string) => `/api/businesses/${businessId}${path}`;

export type MaterialInput = {
  name: string;
  category: string;
  purchasePriceCents: number;
  purchaseQuantity: number;
  unit: string;
  wastePercent?: number;
  purchaseDate?: string | null;
};

/**
 * Inclui os arquivados de propósito: material usado em um serviço não pode ser
 * excluído, só arquivado, e sumir da tela deixaria a usuária sem como restaurar.
 */
export const listMaterials = ({ token, businessId }: Scope) =>
  items(apiRequest<{ items: Material[] }>(scoped(businessId, '/materials?includeArchived=true'), { token }));

export const createMaterial = ({ token, businessId }: Scope, input: MaterialInput) =>
  apiRequest<Material>(scoped(businessId, '/materials'), { method: 'POST', body: input, token });

export const updateMaterial = ({ token, businessId }: Scope, id: string, input: Partial<MaterialInput>) =>
  apiRequest<Material>(scoped(businessId, `/materials/${id}`), { method: 'PATCH', body: input, token });

export const deleteMaterial = ({ token, businessId }: Scope, id: string) =>
  apiRequest<void>(scoped(businessId, `/materials/${id}`), { method: 'DELETE', token });

/** Arquivar preserva o histórico; é o caminho quando o material já foi usado. */
export const archiveMaterial = ({ token, businessId }: Scope, id: string) =>
  apiRequest<Material>(scoped(businessId, `/materials/${id}/archive`), { method: 'POST', token });

export const restoreMaterial = ({ token, businessId }: Scope, id: string) =>
  apiRequest<Material>(scoped(businessId, `/materials/${id}/restore`), { method: 'POST', token });

export type FixedCostInput = { name: string; category: string; monthlyAmountCents: number; isActive?: boolean };

export const listFixedCosts = ({ token, businessId }: Scope) =>
  items(apiRequest<{ items: FixedCost[] }>(scoped(businessId, '/fixed-costs'), { token }));

export const createFixedCost = ({ token, businessId }: Scope, input: FixedCostInput) =>
  apiRequest<FixedCost>(scoped(businessId, '/fixed-costs'), { method: 'POST', body: input, token });

export const updateFixedCost = ({ token, businessId }: Scope, id: string, input: Partial<FixedCostInput>) =>
  apiRequest<FixedCost>(scoped(businessId, `/fixed-costs/${id}`), { method: 'PATCH', body: input, token });

export const deleteFixedCost = ({ token, businessId }: Scope, id: string) =>
  apiRequest<void>(scoped(businessId, `/fixed-costs/${id}`), { method: 'DELETE', token });

export type ServiceInput = {
  name: string;
  category: string;
  durationMinutes: number;
  desiredMarginPercent: number;
  currentPriceCents?: number | null;
  otherDirectCostCents?: number;
  salesFeePercent?: number;
  materials?: ServiceMaterial[];
};

/**
 * Inclui os arquivados pelo mesmo motivo dos materiais: o serviço arquivado
 * sai da tabela mas continua existindo, e sem ele na lista não haveria como
 * restaurá-lo nem como explicar um cálculo antigo.
 */
export const listServices = ({ token, businessId }: Scope) =>
  items(apiRequest<{ items: Service[] }>(scoped(businessId, '/services?includeArchived=true'), { token }));

export const createService = ({ token, businessId }: Scope, input: ServiceInput) =>
  apiRequest<Service>(scoped(businessId, '/services'), { method: 'POST', body: input, token });

export const updateService = ({ token, businessId }: Scope, id: string, input: Partial<ServiceInput>) =>
  apiRequest<Service>(scoped(businessId, `/services/${id}`), { method: 'PATCH', body: input, token });

export const deleteService = ({ token, businessId }: Scope, id: string) =>
  apiRequest<void>(scoped(businessId, `/services/${id}`), { method: 'DELETE', token });

/** Arquivar tira o serviço da tabela sem apagar o que ele já explicou no histórico. */
export const archiveService = ({ token, businessId }: Scope, id: string) =>
  apiRequest<Service>(scoped(businessId, `/services/${id}/archive`), { method: 'POST', token });

export const restoreService = ({ token, businessId }: Scope, id: string) =>
  apiRequest<Service>(scoped(businessId, `/services/${id}/restore`), { method: 'POST', token });

export const duplicateService = ({ token, businessId }: Scope, id: string) =>
  apiRequest<Service>(scoped(businessId, `/services/${id}/duplicate`), { method: 'POST', body: {}, token });

/**
 * Calcula com os dados cadastrados; `save` grava no histórico imutável.
 *
 * `currentPriceCents` compara com um preço hipotético sem tocar no cadastro,
 * que é a exigência do `RF-09`.
 */
export const priceService = (
  { token, businessId }: Scope,
  id: string,
  options: { save?: boolean; currentPriceCents?: number | null } = {},
) =>
  apiRequest<{ serviceId: string; result: PricingResult; saved: Calculation | null }>(
    scoped(businessId, `/services/${id}/pricing`),
    { method: 'POST', body: options, token },
  );

/**
 * Histórico do negócio.
 *
 * `limitedByPlan` avisa que existem cálculos além da janela do plano gratuito.
 * Eles continuam gravados — o item F-01 proíbe apagar dado ao atingir limite.
 */
export const listCalculations = ({ token, businessId }: Scope) =>
  apiRequest<{ items: Calculation[]; total: number; limitedByPlan: boolean }>(
    scoped(businessId, '/calculations'),
    { token },
  );

/** Cálculo avulso gravado no histórico: é por aqui que o cálculo anônimo migra. */
export const saveCalculation = ({ token, businessId }: Scope, input: PublicPricingInput) =>
  apiRequest<{ result: PricingResult; saved: Calculation }>(scoped(businessId, '/calculations'), {
    method: 'POST',
    body: input,
    token,
  });

export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'DONE' | 'CANCELED' | 'NO_SHOW';

/** Quem marcou: a profissional pelo aplicativo, ou a cliente pelo link. */
export type AppointmentSource = 'MANUAL' | 'ONLINE';

export type Appointment = {
  id: string;
  serviceId: string | null;
  clientName: string;
  /** Contato da cliente. Obrigatório em quem marcou pelo link, nulo no resto. */
  clientPhone: string | null;
  source: AppointmentSource;
  /** Momento com fuso, em ISO. */
  startsAt: string;
  durationMinutes: number;
  /** Combinado com a cliente. */
  priceCents: number;
  /** Recebido de fato. */
  paidCents: number;
  paidAt: string | null;
  status: AppointmentStatus;
  notes: string | null;
  /** Quanto do combinado ainda não entrou. */
  pendingCents: number;
};

export type DaySummary = {
  appointments: number;
  expectedCents: number;
  receivedCents: number;
  pendingCents: number;
  occupiedMinutes: number;
};

export type AppointmentInput = {
  clientName: string;
  serviceId?: string | null;
  startsAt: string;
  durationMinutes: number;
  priceCents: number;
  paidCents?: number;
  status?: AppointmentStatus;
  notes?: string | null;
};

/** Data local no formato que a agenda da API espera. */
export const dayParam = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const listAppointments = ({ token, businessId }: Scope, range: { day?: Date; from?: Date; to?: Date }) => {
  const query = range.from && range.to
    ? `?from=${dayParam(range.from)}&to=${dayParam(range.to)}`
    : `?day=${dayParam(range.day ?? new Date())}`;
  return items(apiRequest<{ items: Appointment[] }>(scoped(businessId, `/appointments${query}`), { token }));
};

export const getDaySummary = ({ token, businessId }: Scope, day: Date = new Date()) =>
  apiRequest<DaySummary>(scoped(businessId, `/appointments/summary?day=${dayParam(day)}`), { token });

export const createAppointment = ({ token, businessId }: Scope, input: AppointmentInput) =>
  apiRequest<Appointment>(scoped(businessId, '/appointments'), { method: 'POST', body: input, token });

export const updateAppointment = ({ token, businessId }: Scope, id: string, input: Partial<AppointmentInput>) =>
  apiRequest<Appointment>(scoped(businessId, `/appointments/${id}`), { method: 'PATCH', body: input, token });

/** Sem valor, quita o combinado; com valor, registra pagamento parcial. */
export const settleAppointment = ({ token, businessId }: Scope, id: string, paidCents?: number) =>
  apiRequest<Appointment>(scoped(businessId, `/appointments/${id}/settle`), {
    method: 'POST',
    body: paidCents === undefined ? {} : { paidCents },
    token,
  });

export const deleteAppointment = ({ token, businessId }: Scope, id: string) =>
  apiRequest<void>(scoped(businessId, `/appointments/${id}`), { method: 'DELETE', token });

// --- agenda pública -------------------------------------------------------

/**
 * Uma faixa do expediente como o servidor **lê**: relógio, não minuto.
 *
 * A escrita usa outro formato, e a assimetria é do servidor. Ela é resolvida em
 * `lib/booking.ts`, na borda, para que a tela conheça um formato só.
 */
export type BusinessHour = { weekday: number; start: string; end: string };

/** Uma faixa como o servidor **grava**: minutos desde a meia-noite. */
export type BusinessHourInput = { weekday: number; startMinute: number; endMinute: number };

export const getBusinessHours = ({ token, businessId }: Scope) =>
  items(apiRequest<{ items: BusinessHour[] }>(scoped(businessId, '/hours'), { token }));

/**
 * Grava a semana inteira de uma vez.
 *
 * A rota substitui tudo o que estava lá: mandar meia semana apaga a outra
 * metade. Por isso a tela sempre envia o expediente completo, e não a mudança.
 */
export const saveBusinessHours = ({ token, businessId }: Scope, hours: BusinessHourInput[]) =>
  items(apiRequest<{ items: BusinessHour[] }>(scoped(businessId, '/hours'), {
    method: 'PUT',
    body: { items: hours },
    token,
  }));

/** Liga a agenda pública. Já ligada, devolve o mesmo link — chamar de novo é seguro. */
export const enableBookingLink = ({ token, businessId }: Scope) =>
  apiRequest<{ bookingToken: string }>(scoped(businessId, '/booking-link'), { method: 'POST', body: {}, token });

/** Troca o link. O endereço anterior deixa de existir na hora. */
export const regenerateBookingLink = ({ token, businessId }: Scope) =>
  apiRequest<{ bookingToken: string }>(scoped(businessId, '/booking-link/regenerate'), {
    method: 'POST',
    body: {},
    token,
  });

export const disableBookingLink = ({ token, businessId }: Scope) =>
  apiRequest<void>(scoped(businessId, '/booking-link'), { method: 'DELETE', token });

/** O que a página pública mostra: nome, fuso e os serviços que a cliente escolhe. */
export type BookingPage = {
  businessName: string | null;
  segment: string;
  timezone: string;
  services: { id: string; name: string; category: string; durationMinutes: number; priceCents: number | null }[];
};

/**
 * A página pública vista de fora, sem sessão.
 *
 * É o que confirma que o link guardado no aparelho ainda vale: a rota responde
 * 404 tanto para link desconhecido quanto para agenda desligada. E, de quebra,
 * mostra à profissional exatamente os serviços que a cliente vê — serviço sem
 * preço o servidor não publica.
 */
export const getBookingPage = (bookingToken: string) =>
  apiRequest<BookingPage>(`/api/booking/${bookingToken}`);

export const getSubscription = ({ token, businessId }: Scope) =>
  apiRequest<SubscriptionStatus>(scoped(businessId, '/subscription'), { token });

/**
 * Pede o cancelamento ao processador.
 *
 * Só funciona para o canal que o servidor consegue cancelar — hoje, a web. Loja
 * de aplicativo não permite que o app cancele a assinatura de ninguém: a
 * resposta é `409` e a interface precisa dizer onde cancelar.
 */
export const cancelSubscription = ({ token, businessId }: Scope, subscriptionId: string) =>
  apiRequest<{ status: string; message: string }>(
    scoped(businessId, `/subscription/${subscriptionId}/cancel`),
    { method: 'POST', token },
  );

export const startCheckout = (
  { token, businessId }: Scope,
  input: { plan: 'PREMIUM' | 'MASTER'; billingPeriod: 'MONTHLY' | 'ANNUAL' },
) =>
  apiRequest<{ url?: string; provider?: string }>(scoped(businessId, '/subscription/checkout'), {
    method: 'POST',
    body: input,
    token,
  });

// --- calculadora pública e catálogos -------------------------------------

export type PublicPricingInput = {
  materialCost: number;
  durationMinutes: number;
  hourlyRate: number;
  monthlyFixedCosts: number;
  monthlyProductiveHours: number;
  salesFeePercent: number;
  desiredMarginPercent: number;
  /** Preço praticado hoje: liga a análise do `RF-08` no resultado. */
  currentPrice?: number;
  roundingStrategy?: 'none' | '1' | '5' | '10' | '90';
};

/** A calculadora não fica atrás de cadastro: esta rota é pública de propósito. */
export const calculatePrice = (input: PublicPricingInput) =>
  apiRequest<PricingResult>('/api/pricing/calculate', { method: 'POST', body: input });

export type GoalInput = {
  totalCost: number;
  monthlyProfitGoal: number;
  monthlyAppointments: number;
  salesFeePercent?: number;
  currentPrice?: number;
};

/** Simulador de meta, também público: é projeção sobre números avulsos. */
export const simulateGoal = (input: GoalInput) =>
  apiRequest<GoalResult>('/api/pricing/goal', { method: 'POST', body: input });

export const getCatalog = (segment?: string) =>
  apiRequest<Catalog>(`/api/catalog${segment ? `?segment=${segment}` : ''}`);
