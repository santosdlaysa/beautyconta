import type { PlanSlug } from "../../domain/billing/plan-limits";
import type {
  ChannelSlug,
  SubscriptionStatusSlug,
} from "../../domain/billing/subscription-access";
import type { SegmentSlug, UnitSlug, WorkModelSlug } from "../../domain/catalog/catalogs";

/**
 * Formato dos registros trocados entre aplicação e infraestrutura.
 *
 * Dinheiro trafega como inteiro de centavos em `number`, não `BigInt`: o teto
 * de `Money` é 10^10 centavos, bem abaixo de `Number.MAX_SAFE_INTEGER`, e
 * manter `BigInt` aqui prenderia a aplicação a um tipo do Prisma. Percentuais
 * são frações entre 0 e 1, como no banco e nas fórmulas do documento 03.
 */

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

/** Credenciais lidas só pelo caso de uso de entrada; nunca serializadas. */
export type UserCredentialsRecord = {
  id: string;
  passwordHash: string | null;
  deletedAt: Date | null;
};

export type SessionRecord = {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
};

export type BusinessRecord = {
  id: string;
  ownerUserId: string;
  name: string | null;
  primaryCategory: SegmentSlug;
  /** Outros segmentos atendidos; não entra em cálculo, orienta catálogo. */
  secondaryCategories: SegmentSlug[];
  workModel: WorkModelSlug;
  currency: string;
  timezone: string;
  /** Endereço secreto da agenda pública; nulo enquanto ela não for aberta. */
  bookingSlug: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AllocationMethodSlug = "PRODUCTIVE_HOUR" | "APPOINTMENT";
export type RoundingStrategySlug =
  | "NONE"
  | "NEAREST_1"
  | "NEAREST_5"
  | "NEAREST_10"
  | "ENDING_90";

export type BusinessSettingsRecord = {
  businessId: string;
  desiredMonthlyWithdrawalCents: number;
  productiveHoursPerMonth: number;
  estimatedAppointmentsPerMonth: number;
  fixedCostAllocationMethod: AllocationMethodSlug;
  roundingStrategy: RoundingStrategySlug;
  /** Meta de lucro mensal, além da retirada. Nulo é "não disse". */
  monthlyProfitGoalCents: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MaterialRecord = {
  id: string;
  businessId: string;
  name: string;
  category: string;
  purchasePriceCents: number;
  purchaseQuantity: number;
  unit: UnitSlug;
  /** Fração entre 0 e 1. */
  wastePercentage: number;
  purchaseDate: Date | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type FixedCostRecord = {
  id: string;
  businessId: string;
  name: string;
  category: string;
  monthlyAmountCents: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ServiceMaterialRecord = {
  materialId: string;
  quantityUsed: number;
};

export type ServiceRecord = {
  id: string;
  businessId: string;
  name: string;
  category: string;
  durationMinutes: number;
  /** Fração entre 0 e 1. */
  desiredMargin: number;
  currentPriceCents: number | null;
  otherDirectCostCents: number;
  /** Fração entre 0 e 1. */
  salesFeePercentage: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  materials: ServiceMaterialRecord[];
};

/** Como o dinheiro entrou. Nulo enquanto nada foi recebido. */
export type PaymentMethodSlug = "CASH" | "PIX" | "DEBIT_CARD" | "CREDIT_CARD" | "TRANSFER" | "OTHER";

export type AppointmentStatusSlug = "SCHEDULED" | "CONFIRMED" | "DONE" | "CANCELED" | "NO_SHOW";

/** Marcado pela profissional ou pela cliente, no link da agenda pública. */
export type AppointmentSourceSlug = "MANUAL" | "ONLINE";

/** Faixa de expediente de um dia da semana, em minutos desde a meia-noite. */
export type BusinessHourRecord = {
  id: string;
  businessId: string;
  /** 0 é domingo. */
  weekday: number;
  startMinute: number;
  endMinute: number;
};

export type AppointmentRecord = {
  id: string;
  businessId: string;
  serviceId: string | null;
  clientName: string;
  clientPhone: string | null;
  source: AppointmentSourceSlug;
  startsAt: Date;
  durationMinutes: number;
  /** Combinado com a cliente. */
  priceCents: number;
  /** Recebido de fato; zero enquanto não entra nada. */
  paidCents: number;
  paidAt: Date | null;
  paymentMethod: PaymentMethodSlug | null;
  status: AppointmentStatusSlug;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PricingCalculationRecord = {
  id: string;
  businessId: string;
  serviceId: string | null;
  calculationVersion: number;
  /** Fotografia das entradas; nunca é reescrita depois de gravada. */
  inputSnapshot: unknown;
  materialCostCents: number;
  laborCostCents: number;
  allocatedFixedCostCents: number;
  otherDirectCostCents: number;
  totalBaseCostCents: number;
  minimumPriceCents: number;
  suggestedPriceCents: number;
  commercialPriceCents: number;
  expectedProfitCents: number;
  /** Fração entre 0 e 1. */
  expectedMargin: number;
  createdAt: Date;
};

export type EquipmentRecord = {
  id: string;
  businessId: string;
  name: string;
  type: string;
  acquisitionPriceCents: number;
  residualValueCents: number;
  usefulLifeMonths: number;
  acquisitionDate: Date;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type SubscriptionProviderSlug = "MERCADO_PAGO" | "REVENUECAT";
export type BillingPeriodSlug = "MONTHLY" | "ANNUAL";

/**
 * Oferta de assinatura à venda, com o preço que a tela mostra.
 *
 * Vale para a venda pela web. Nas lojas quem manda no preço é a loja.
 */
export type PlanOfferRecord = {
  id: string;
  plan: "PREMIUM" | "MASTER";
  billingPeriod: BillingPeriodSlug;
  /** Centavos inteiros, conforme o ADR-0002. */
  priceCents: number;
  isActive: boolean;
  benefits: string[];
  updatedAt: Date;
};

export type SubscriptionRecord = {
  id: string;
  businessId: string;
  plan: PlanSlug;
  status: SubscriptionStatusSlug;
  channel: ChannelSlug;
  provider: SubscriptionProviderSlug;
  billingPeriod: BillingPeriodSlug;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  revenuecatAppUserId: string | null;
  mpPreapprovalId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type BillingEventRecord = {
  id: string;
  businessId: string | null;
  subscriptionId: string | null;
  source: SubscriptionProviderSlug;
  externalEventId: string;
  type: string;
  payload: unknown;
  processedAt: Date | null;
  createdAt: Date;
};
