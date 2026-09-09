import { z } from "zod";
import {
  EQUIPMENT_TYPES,
  SEGMENTS,
  UNITS,
  WORK_MODELS,
} from "../../../domain/catalog/catalogs";

/**
 * Esquemas de borda.
 *
 * Dinheiro entra em centavos inteiros, percentual entra em pontos percentuais.
 * O teto monetário é o mesmo de `Money`, para que o estouro seja recusado antes
 * de chegar ao banco.
 */
const MAX_CENTS = 10_000_000_000;

export const moneyCents = z.number().int().min(0).max(MAX_CENTS);
export const percent = (max = 100) => z.number().min(0).max(max);
export const nonEmptyText = (max = 120) => z.string().trim().min(1).max(max);
/** Categoria personalizada é texto livre, conforme o documento 06. */
export const categorySlug = z.string().trim().min(1).max(60);

const segmentSlug = z.enum(SEGMENTS.map((item) => item.slug) as [string, ...string[]]);
const workModelSlug = z.enum(WORK_MODELS.map((item) => item.slug) as [string, ...string[]]);
const unitSlug = z.enum(UNITS.map((item) => item.slug) as [string, ...string[]]);
const equipmentType = z.enum(EQUIPMENT_TYPES as unknown as [string, ...string[]]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD");

/** O tamanho mínimo é regra de domínio; aqui só limitamos o que trafega. */
const password = z.string().min(1).max(200);

export const createUserSchema = z.object({
  name: nonEmptyText(),
  email: z.email().trim().max(320),
  password,
});

export const signInSchema = z.object({
  email: z.email().trim().max(320),
  password,
});

export const changePasswordSchema = z.object({
  currentPassword: password,
  newPassword: password,
});

export const updateUserSchema = z.object({ name: nonEmptyText() });

export const createBusinessSchema = z.object({
  name: nonEmptyText().nullish(),
  primaryCategory: segmentSlug,
  workModel: workModelSlug,
  timezone: z.string().trim().min(1).max(60).optional(),
});

export const updateBusinessSchema = createBusinessSchema.partial();

export const settingsSchema = z.object({
  desiredMonthlyWithdrawalCents: moneyCents,
  /** Maior que zero: é divisor do valor/hora e do rateio por hora produtiva. */
  productiveHoursPerMonth: z.number().positive().max(744),
  estimatedAppointmentsPerMonth: z.number().int().positive().max(100_000),
  fixedCostAllocationMethod: z.enum(["PRODUCTIVE_HOUR", "APPOINTMENT"]),
  roundingStrategy: z.enum(["NONE", "NEAREST_1", "NEAREST_5", "NEAREST_10", "ENDING_90"]),
});

export const createMaterialSchema = z.object({
  name: nonEmptyText(),
  category: categorySlug,
  purchasePriceCents: moneyCents,
  purchaseQuantity: z.number().positive().max(1_000_000),
  unit: unitSlug,
  wastePercent: percent().optional(),
  purchaseDate: isoDate.nullish(),
});

export const updateMaterialSchema = createMaterialSchema.partial();

export const createFixedCostSchema = z.object({
  name: nonEmptyText(),
  category: categorySlug,
  monthlyAmountCents: moneyCents,
  isActive: z.boolean().optional(),
});

export const updateFixedCostSchema = createFixedCostSchema.partial();

const serviceMaterialSchema = z.object({
  materialId: z.uuid(),
  quantityUsed: z.number().min(0).max(1_000_000),
  unit: unitSlug.optional(),
});

export const createServiceSchema = z.object({
  name: nonEmptyText(),
  category: categorySlug,
  durationMinutes: z.number().int().min(1).max(1440),
  desiredMarginPercent: percent(95),
  currentPriceCents: moneyCents.nullish(),
  otherDirectCostCents: moneyCents.optional(),
  salesFeePercent: percent(99).optional(),
  materials: z.array(serviceMaterialSchema).max(100).optional(),
});

export const updateServiceSchema = createServiceSchema.partial();

export const duplicateServiceSchema = z.object({ name: nonEmptyText().optional() });

export const priceServiceSchema = z.object({
  /** Preço praticado hoje, se a usuária quiser comparar sem alterar o cadastro. */
  currentPriceCents: moneyCents.nullish(),
  /** Quando verdadeiro, o resultado entra no histórico imutável. */
  save: z.boolean().optional(),
});

const appointmentStatus = z.enum(["SCHEDULED", "CONFIRMED", "DONE", "CANCELED", "NO_SHOW"]);
/** Momento com fuso, como o aparelho envia. */
const isoDateTime = z.string().datetime({ offset: true });

export const createAppointmentSchema = z.object({
  clientName: nonEmptyText(),
  serviceId: z.uuid().nullish(),
  startsAt: isoDateTime,
  durationMinutes: z.number().int().min(1).max(1440),
  priceCents: moneyCents,
  paidCents: moneyCents.optional(),
  status: appointmentStatus.optional(),
  notes: z.string().trim().max(500).nullish(),
});

export const updateAppointmentSchema = createAppointmentSchema.partial();

/** Sem valor, quita o combinado; com valor, registra pagamento parcial. */
export const settleAppointmentSchema = z.object({ paidCents: moneyCents.optional() });

/**
 * Período da agenda em data local. `day` sozinho vale um dia; `from` e `to`
 * valem um intervalo com as duas pontas incluídas.
 */
export const agendaQuerySchema = z
  .object({ day: isoDate.optional(), from: isoDate.optional(), to: isoDate.optional() })
  .refine((value) => !(value.from && !value.to) && !(value.to && !value.from), {
    message: "Informe as duas datas do período.",
    path: ["to"],
  });

export const createEquipmentSchema = z.object({
  name: nonEmptyText(),
  type: equipmentType,
  acquisitionPriceCents: moneyCents,
  residualValueCents: moneyCents.optional(),
  usefulLifeMonths: z.number().int().min(1).max(600),
  acquisitionDate: isoDate,
});

export const updateEquipmentSchema = createEquipmentSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

export const checkoutSchema = z.object({
  plan: z.enum(["PREMIUM", "MASTER"]),
  billingPeriod: z.enum(["MONTHLY", "ANNUAL"]),
  returnUrl: z.url().max(2048).optional(),
});

export const listQuerySchema = z.object({
  includeArchived: z.enum(["true", "false"]).optional(),
  includeInactive: z.enum(["true", "false"]).optional(),
  serviceId: z.uuid().optional(),
});

export const idParamSchema = z.object({ id: z.uuid() });
export const businessParamSchema = z.object({ businessId: z.uuid() });

/** Percentual da borda para a fração que o banco e as fórmulas usam. */
export const toFraction = (value: number): number => value / 100;

/** Data em `AAAA-MM-DD` para `Date` em UTC, sem deslocamento de fuso. */
export const toDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
