import type {
  AppointmentRecord,
  BusinessRecord,
  BusinessSettingsRecord,
  EquipmentRecord,
  FixedCostRecord,
  MaterialRecord,
  PricingCalculationRecord,
  ServiceRecord,
  SubscriptionRecord,
  UserRecord,
} from "../../../application/ports/records";

/**
 * Saída HTTP dos recursos.
 *
 * Duas convenções, ambas para eliminar ambiguidade na leitura pela interface:
 *
 * - dinheiro sai em centavos inteiros, sempre com o sufixo `Cents`. É o dado
 *   exato do banco e não passa por ponto flutuante no caminho;
 * - percentual sai em pontos percentuais, com o sufixo `Percent`. O banco
 *   guarda fração, e a conversão acontece aqui, na borda, e em nenhum outro
 *   lugar — a mesma regra que `Percentage` aplica no domínio.
 *
 * A calculadora pública é a exceção deliberada: ela responde em reais, como o
 * aplicativo Expo já espera.
 */

const toPercent = (fraction: number): number => Math.round(fraction * 1_000_000) / 10_000;

const iso = (date: Date | null): string | null => date?.toISOString() ?? null;

/** Único lugar do sistema em que o token em claro aparece na resposta. */
export function serializeSession(session: { token: string; expiresAt: Date; user: UserRecord }) {
  return {
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    user: serializeUser(session.user),
  };
}

export function serializeUser(user: UserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerifiedAt: iso(user.emailVerifiedAt),
    createdAt: user.createdAt.toISOString(),
  };
}

export function serializeBusiness(business: BusinessRecord) {
  return {
    id: business.id,
    name: business.name,
    primaryCategory: business.primaryCategory,
    workModel: business.workModel,
    currency: business.currency,
    timezone: business.timezone,
    /**
     * Endereço da agenda pública, ou `null` quando ela está fechada.
     *
     * Sai aqui porque esta resposta só chega à dona do negócio, e sem isso o
     * aplicativo não tinha como saber se o link existe — precisava guardar uma
     * cópia no aparelho, que some ao trocar de celular.
     */
    bookingToken: business.bookingToken,
    createdAt: business.createdAt.toISOString(),
    updatedAt: business.updatedAt.toISOString(),
  };
}

export function serializeSettings(settings: BusinessSettingsRecord) {
  return {
    businessId: settings.businessId,
    desiredMonthlyWithdrawalCents: settings.desiredMonthlyWithdrawalCents,
    productiveHoursPerMonth: settings.productiveHoursPerMonth,
    estimatedAppointmentsPerMonth: settings.estimatedAppointmentsPerMonth,
    fixedCostAllocationMethod: settings.fixedCostAllocationMethod,
    roundingStrategy: settings.roundingStrategy,
    /** Derivado, para a interface não repetir a conta do item E-03. */
    hourlyRateCents:
      settings.productiveHoursPerMonth > 0
        ? Math.round(settings.desiredMonthlyWithdrawalCents / settings.productiveHoursPerMonth)
        : null,
    updatedAt: settings.updatedAt.toISOString(),
  };
}

export function serializeMaterial(material: MaterialRecord) {
  return {
    id: material.id,
    name: material.name,
    category: material.category,
    purchasePriceCents: material.purchasePriceCents,
    purchaseQuantity: material.purchaseQuantity,
    unit: material.unit,
    wastePercent: toPercent(material.wastePercentage),
    /** Custo de uma unidade da medida de compra, já com a perda embutida. */
    unitCostCents:
      material.purchaseQuantity > 0
        ? Math.round(
            (material.purchasePriceCents / material.purchaseQuantity) *
              (1 + material.wastePercentage),
          )
        : null,
    purchaseDate: material.purchaseDate ? material.purchaseDate.toISOString().slice(0, 10) : null,
    isArchived: material.isArchived,
    createdAt: material.createdAt.toISOString(),
    updatedAt: material.updatedAt.toISOString(),
  };
}

export function serializeFixedCost(fixedCost: FixedCostRecord) {
  return {
    id: fixedCost.id,
    name: fixedCost.name,
    category: fixedCost.category,
    monthlyAmountCents: fixedCost.monthlyAmountCents,
    isActive: fixedCost.isActive,
    createdAt: fixedCost.createdAt.toISOString(),
    updatedAt: fixedCost.updatedAt.toISOString(),
  };
}

export function serializeService(service: ServiceRecord) {
  return {
    id: service.id,
    name: service.name,
    category: service.category,
    durationMinutes: service.durationMinutes,
    desiredMarginPercent: toPercent(service.desiredMargin),
    currentPriceCents: service.currentPriceCents,
    otherDirectCostCents: service.otherDirectCostCents,
    salesFeePercent: toPercent(service.salesFeePercentage),
    isArchived: service.isArchived,
    materials: service.materials.map((item) => ({
      materialId: item.materialId,
      quantityUsed: item.quantityUsed,
    })),
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}

export function serializeCalculation(calculation: PricingCalculationRecord) {
  return {
    id: calculation.id,
    serviceId: calculation.serviceId,
    calculationVersion: calculation.calculationVersion,
    inputSnapshot: calculation.inputSnapshot,
    materialCostCents: calculation.materialCostCents,
    laborCostCents: calculation.laborCostCents,
    allocatedFixedCostCents: calculation.allocatedFixedCostCents,
    otherDirectCostCents: calculation.otherDirectCostCents,
    totalBaseCostCents: calculation.totalBaseCostCents,
    minimumPriceCents: calculation.minimumPriceCents,
    suggestedPriceCents: calculation.suggestedPriceCents,
    commercialPriceCents: calculation.commercialPriceCents,
    expectedProfitCents: calculation.expectedProfitCents,
    expectedMarginPercent: toPercent(calculation.expectedMargin),
    createdAt: calculation.createdAt.toISOString(),
  };
}

export function serializeAppointment(appointment: AppointmentRecord) {
  return {
    id: appointment.id,
    serviceId: appointment.serviceId,
    clientName: appointment.clientName,
    /** Como falar com a cliente — o único contato de quem marcou pelo link. */
    clientPhone: appointment.clientPhone,
    /**
     * De onde veio. A profissional precisa distinguir o que ela marcou do que
     * entrou sozinho pela agenda pública, nem que seja para conferir antes.
     */
    source: appointment.source,
    startsAt: appointment.startsAt.toISOString(),
    durationMinutes: appointment.durationMinutes,
    priceCents: appointment.priceCents,
    paidCents: appointment.paidCents,
    paidAt: iso(appointment.paidAt),
    status: appointment.status,
    notes: appointment.notes,
    /** Derivado para a interface não repetir a subtração em cada tela. */
    pendingCents: Math.max(appointment.priceCents - appointment.paidCents, 0),
    createdAt: appointment.createdAt.toISOString(),
  };
}

export function serializeEquipment(equipment: EquipmentRecord) {
  return {
    id: equipment.id,
    name: equipment.name,
    type: equipment.type,
    acquisitionPriceCents: equipment.acquisitionPriceCents,
    residualValueCents: equipment.residualValueCents,
    usefulLifeMonths: equipment.usefulLifeMonths,
    acquisitionDate: equipment.acquisitionDate.toISOString().slice(0, 10),
    isArchived: equipment.isArchived,
    createdAt: equipment.createdAt.toISOString(),
    updatedAt: equipment.updatedAt.toISOString(),
  };
}

export function serializeSubscription(subscription: SubscriptionRecord) {
  return {
    id: subscription.id,
    plan: subscription.plan,
    status: subscription.status,
    channel: subscription.channel,
    provider: subscription.provider,
    billingPeriod: subscription.billingPeriod,
    currentPeriodStart: iso(subscription.currentPeriodStart),
    currentPeriodEnd: iso(subscription.currentPeriodEnd),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    createdAt: subscription.createdAt.toISOString(),
  };
}

/**
 * Exportação completa (`RF-12`).
 *
 * Usa os mesmos serializadores das rotas: o arquivo que a pessoa leva embora
 * fala a mesma língua da API, e não um formato que só existe aqui.
 */
export function serializeExport(data: {
  exportedAt: Date;
  business: BusinessRecord;
  settings: BusinessSettingsRecord | null;
  materials: MaterialRecord[];
  fixedCosts: FixedCostRecord[];
  services: ServiceRecord[];
  calculations: PricingCalculationRecord[];
  equipment: EquipmentRecord[];
  subscriptions: SubscriptionRecord[];
}) {
  return {
    exportedAt: data.exportedAt.toISOString(),
    business: serializeBusiness(data.business),
    settings: data.settings ? serializeSettings(data.settings) : null,
    materials: data.materials.map(serializeMaterial),
    fixedCosts: data.fixedCosts.map(serializeFixedCost),
    services: data.services.map(serializeService),
    calculations: data.calculations.map(serializeCalculation),
    equipment: data.equipment.map(serializeEquipment),
    subscriptions: data.subscriptions.map(serializeSubscription),
  };
}
