import { calculatePrice, type PricingInput, type PricingResult } from "../../domain/pricing/calculate-price";
import { DomainError } from "../../domain/shared";
import { NotFoundError } from "../errors";
import type {
  BusinessRepository,
  CalculationRepository,
  FixedCostRepository,
  MaterialRepository,
  ServiceRepository,
} from "../ports/repositories";
import type {
  AllocationMethodSlug,
  PricingCalculationRecord,
  RoundingStrategySlug,
} from "../ports/records";
import type { BusinessAccess } from "../services/business-access";

const ALLOCATION: Record<AllocationMethodSlug, PricingInput["allocationMethod"]> = {
  PRODUCTIVE_HOUR: "productive_hour",
  APPOINTMENT: "appointment",
};

const ROUNDING: Record<RoundingStrategySlug, NonNullable<PricingInput["roundingStrategy"]>> = {
  NONE: "none",
  NEAREST_1: "1",
  NEAREST_5: "5",
  NEAREST_10: "10",
  ENDING_90: "90",
};

/** Reais para centavos inteiros. A conversão acontece só aqui e no mapper HTTP. */
const toCents = (reais: number): number => Math.round(reais * 100);

export type PricedService = {
  serviceId: string;
  input: PricingInput;
  result: PricingResult;
};

/**
 * Preço de um serviço do catálogo.
 *
 * O motor não consulta banco: este caso de uso é quem junta serviço, materiais,
 * custos fixos e configuração, converte para a unidade que o motor entende e o
 * chama uma única vez — a divisão de responsabilidade da seção 2 do documento
 * 04.
 */
export class PriceService {
  constructor(
    private readonly access: BusinessAccess,
    private readonly services: ServiceRepository,
    private readonly materials: MaterialRepository,
    private readonly fixedCosts: FixedCostRepository,
    private readonly businesses: BusinessRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    serviceId: string,
    overrides: { currentPriceCents?: number | null } = {},
  ): Promise<PricedService> {
    await this.access.authorize(userId, businessId);

    const service = await this.services.findById(businessId, serviceId);
    if (!service) throw new NotFoundError("Serviço");

    const settings = await this.businesses.getSettings(businessId);
    if (!settings) {
      throw new DomainError(
        "Antes de calcular, informe a retirada desejada e as horas produtivas do mês.",
        "settings",
      );
    }

    const [materials, monthlyFixedCostCents] = await Promise.all([
      this.materials.findManyByIds(
        businessId,
        service.materials.map((item) => item.materialId),
      ),
      this.fixedCosts.monthlyTotalCents(businessId),
    ]);

    const byId = new Map(materials.map((material) => [material.id, material]));

    const materialInputs = service.materials.map((item) => {
      const material = byId.get(item.materialId);
      if (!material) throw new NotFoundError("Material");
      return {
        purchasePrice: material.purchasePriceCents / 100,
        purchasedQuantity: material.purchaseQuantity,
        usedQuantity: item.quantityUsed,
        lossPercent: material.wastePercentage * 100,
      };
    });

    // Valor/hora derivado da retirada desejada, item E-03. Quando as horas
    // produtivas são zero o motor recusa, e a mensagem sai daqui com o campo.
    if (settings.productiveHoursPerMonth <= 0) {
      throw new DomainError(
        "Informe quantas horas por mês você realmente atende para calcular o valor da hora.",
        "productiveHoursPerMonth",
      );
    }

    const currentPriceCents =
      overrides.currentPriceCents !== undefined
        ? overrides.currentPriceCents
        : service.currentPriceCents;

    const input: PricingInput = {
      materials: materialInputs,
      durationMinutes: service.durationMinutes,
      hourlyRate:
        settings.desiredMonthlyWithdrawalCents / 100 / settings.productiveHoursPerMonth,
      monthlyFixedCosts: monthlyFixedCostCents / 100,
      monthlyProductiveHours: settings.productiveHoursPerMonth,
      monthlyAppointments: settings.estimatedAppointmentsPerMonth,
      allocationMethod: ALLOCATION[settings.fixedCostAllocationMethod],
      otherDirectCosts: service.otherDirectCostCents / 100,
      salesFeePercent: service.salesFeePercentage * 100,
      desiredMarginPercent: service.desiredMargin * 100,
      roundingStrategy: ROUNDING[settings.roundingStrategy],
      ...(currentPriceCents !== null ? { currentPrice: currentPriceCents / 100 } : {}),
    };

    return { serviceId, input, result: calculatePrice(input) };
  }
}

/**
 * Grava o cálculo no histórico, item E-05.
 *
 * `inputSnapshot` guarda a entrada exatamente como o motor a recebeu. É por
 * isso que editar um material amanhã não muda o cálculo de hoje: o registro não
 * aponta para o cadastro, ele carrega a cópia.
 */
export class SaveCalculation {
  constructor(
    private readonly access: BusinessAccess,
    private readonly calculations: CalculationRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    payload: { serviceId?: string | null; input: PricingInput; result: PricingResult },
  ): Promise<PricingCalculationRecord> {
    await this.access.authorize(userId, businessId);

    const { result, input } = payload;

    return this.calculations.create({
      businessId,
      serviceId: payload.serviceId ?? null,
      calculationVersion: result.calculationVersion,
      inputSnapshot: input as unknown,
      materialCostCents: toCents(result.materialCost),
      laborCostCents: toCents(result.laborCost),
      allocatedFixedCostCents: toCents(result.allocatedFixedCost),
      otherDirectCostCents: toCents(result.otherDirectCosts),
      totalBaseCostCents: toCents(result.totalCost),
      minimumPriceCents: toCents(result.minimumPrice),
      suggestedPriceCents: toCents(result.suggestedPrice),
      commercialPriceCents: toCents(result.commercialPrice),
      expectedProfitCents: toCents(result.expectedProfit),
      expectedMargin: result.expectedMarginPercent / 100,
    });
  }
}
