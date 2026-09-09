/*
 * Espelho do motor de precificação da API, em
 * `backend/src/domain/pricing/calculate-price.ts`.
 *
 * A web calcula localmente, e não por chamada à API, porque as páginas de
 * aquisição orgânica precisam do resultado sem depender de servidor: sem ida e
 * volta de rede antes do primeiro número, sem CORS e sem a API fora do ar
 * derrubando a landing page. O ADR-0001 pede exatamente isso — a mesma lógica
 * servindo app, API e web.
 *
 * Enquanto não existir um pacote publicado com o motor, a cópia é a única forma
 * de cumprir o ADR. Para que ela não divirja em silêncio, o teste
 * `tests/pricing-parity.test.ts` compara este arquivo com o da API caractere a
 * caractere e confere as duas implementações sobre a mesma matriz de entradas.
 *
 * Não corrija nada aqui isoladamente: altere o motor da API e copie de novo.
 */
import { DomainError } from "../shared/domain-error";

export type AllocationMethod = "productive_hour" | "appointment";
export type RoundingStrategy = "none" | "1" | "5" | "10" | "90";
export type MaterialInput = { purchasePrice: number; purchasedQuantity: number; usedQuantity: number; lossPercent?: number };
export type PricingInput = {
  materialCost?: number; materials?: MaterialInput[]; durationMinutes: number; hourlyRate?: number;
  desiredMonthlyWithdrawal?: number; productiveDaysPerMonth?: number; productiveHoursPerDay?: number;
  monthlyFixedCosts: number; monthlyProductiveHours?: number; monthlyAppointments?: number;
  allocationMethod?: AllocationMethod; otherDirectCosts?: number; salesFeePercent: number;
  desiredMarginPercent: number; currentPrice?: number; roundingStrategy?: RoundingStrategy;
};
export type PricingResult = {
  calculationVersion: 1; materialCost: number; laborCost: number; allocatedFixedCost: number; otherDirectCosts: number;
  totalCost: number; minimumPrice: number; suggestedPrice: number; commercialPrice: number; expectedProfit: number;
  expectedMarginPercent: number; allocationMethod: AllocationMethod; hourlyRate: number; currentProfit?: number;
  currentMarginPercent?: number; materials?: number[];
};
const MAX = 100_000_000;
const finite = (value: number, field: string, min = 0, max = MAX) => {
  if (!Number.isFinite(value) || value < min || value > max) throw new DomainError("Confira os dados informados para calcular o preço.", field);
  return value;
};
/**
 * Arredonda para centavos, meio-para-cima.
 *
 * O `Number.EPSILON` que existia aqui não corrigia nada: ele é menor que o
 * passo do ponto flutuante para qualquer valor acima de ~4,5, então a soma
 * virava no-op justamente na faixa em que preços vivem — e valores terminados
 * em meio centavo saíam um centavo abaixo. Arredondar sobre milésimos inteiros
 * decide o empate sempre para o mesmo lado.
 */
const cents = (value: number) => {
  const thousandths = Math.round(value * 1000);
  return (thousandths >= 0
    ? Math.floor(thousandths / 10 + 0.5)
    : -Math.floor(-thousandths / 10 + 0.5)) / 100;
};
function roundCommercial(value: number, strategy: RoundingStrategy): number {
  if (strategy === "none") return cents(value);
  if (strategy === "90") return cents(Math.ceil(value - 0.9) + 0.9);
  const multiple = Number(strategy); return cents(Math.ceil(value / multiple) * multiple);
}

export function calculatePrice(input: PricingInput): PricingResult {
  const duration = finite(input.durationMinutes, "durationMinutes", 1, 1440);
  const fixed = finite(input.monthlyFixedCosts, "monthlyFixedCosts");
  const feePercent = finite(input.salesFeePercent, "salesFeePercent", 0, 99);
  const marginPercent = finite(input.desiredMarginPercent, "desiredMarginPercent", 0, 95);
  const fee = feePercent / 100; const margin = marginPercent / 100;
  if (fee + margin >= 1) throw new DomainError("A soma da taxa de venda e da margem precisa ser menor que 100%.", "salesFeePercent");
  let materialCost = input.materialCost === undefined ? 0 : finite(input.materialCost, "materialCost");
  let breakdown: number[] | undefined;
  if (input.materials) {
    breakdown = input.materials.map((item, index) => {
      const price = finite(item.purchasePrice, `materials.${index}.purchasePrice`);
      const purchased = finite(item.purchasedQuantity, `materials.${index}.purchasedQuantity`, Number.MIN_VALUE);
      const used = finite(item.usedQuantity, `materials.${index}.usedQuantity`);
      const loss = finite(item.lossPercent ?? 0, `materials.${index}.lossPercent`, 0, 100) / 100;
      return price / purchased * used * (1 + loss);
    });
    materialCost = breakdown.reduce((sum, value) => sum + value, 0);
  }
  let hourlyRate = input.hourlyRate ?? 0;
  if (input.desiredMonthlyWithdrawal !== undefined) {
    const days = finite(input.productiveDaysPerMonth ?? 0, "productiveDaysPerMonth", 1, 31);
    const hours = finite(input.productiveHoursPerDay ?? 0, "productiveHoursPerDay", Number.MIN_VALUE, 24);
    hourlyRate = finite(input.desiredMonthlyWithdrawal, "desiredMonthlyWithdrawal") / (days * hours);
  } else hourlyRate = finite(hourlyRate, "hourlyRate");
  const productiveHours = input.monthlyProductiveHours ?? ((input.productiveDaysPerMonth ?? 0) * (input.productiveHoursPerDay ?? 0));
  const method = input.allocationMethod ?? "productive_hour";
  let allocatedFixedCost: number;
  if (method === "appointment") allocatedFixedCost = fixed / finite(input.monthlyAppointments ?? 0, "monthlyAppointments", 1, 100_000);
  else allocatedFixedCost = fixed / finite(productiveHours, "monthlyProductiveHours", Number.MIN_VALUE, 744) * (duration / 60);
  const other = finite(input.otherDirectCosts ?? 0, "otherDirectCosts");
  const labor = duration / 60 * hourlyRate; const total = materialCost + labor + allocatedFixedCost + other;
  const minimum = total / (1 - fee); const suggested = total / (1 - fee - margin);
  const commercial = roundCommercial(suggested, input.roundingStrategy ?? "none");
  const current = input.currentPrice === undefined ? undefined : finite(input.currentPrice, "currentPrice");
  const currentProfit = current === undefined ? undefined : current - total - current * fee;
  return { calculationVersion: 1, materialCost: cents(materialCost), laborCost: cents(labor), allocatedFixedCost: cents(allocatedFixedCost), otherDirectCosts: cents(other), totalCost: cents(total), minimumPrice: cents(minimum), suggestedPrice: cents(suggested), commercialPrice: commercial, expectedProfit: cents(commercial - total - commercial * fee), expectedMarginPercent: cents(commercial ? (commercial - total - commercial * fee) / commercial * 100 : 0), allocationMethod: method, hourlyRate: cents(hourlyRate), currentProfit: currentProfit === undefined ? undefined : cents(currentProfit), currentMarginPercent: current && current > 0 && currentProfit !== undefined ? cents(currentProfit / current * 100) : undefined, materials: breakdown?.map(cents) };
}

export function calculateGoalPrice(input: { totalCost: number; monthlyProfitGoal: number; monthlyAppointments: number; salesFeePercent?: number }) {
  const cost = finite(input.totalCost, "totalCost"); const goal = finite(input.monthlyProfitGoal, "monthlyProfitGoal");
  const appointments = finite(input.monthlyAppointments, "monthlyAppointments", 1, 100_000); const fee = finite(input.salesFeePercent ?? 0, "salesFeePercent", 0, 99) / 100;
  return { calculationVersion: 1 as const, profitPerAppointment: cents(goal / appointments), projectedPrice: cents((cost + goal / appointments) / (1 - fee)) };
}
