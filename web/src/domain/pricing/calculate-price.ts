export type PricingInput = {
  materialCost: number;
  durationMinutes: number;
  hourlyRate: number;
  monthlyFixedCosts: number;
  monthlyProductiveHours: number;
  salesFeePercent: number;
  desiredMarginPercent: number;
  currentPrice?: number;
};

export type PricingResult = {
  materialCost: number;
  laborCost: number;
  allocatedFixedCost: number;
  totalCost: number;
  minimumPrice: number;
  suggestedPrice: number;
  expectedProfit: number;
  expectedMarginPercent: number;
  currentProfit?: number;
  currentMarginPercent?: number;
};

const safe = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculatePrice(input: PricingInput): PricingResult {
  const materialCost = safe(input.materialCost);
  const durationHours = safe(input.durationMinutes) / 60;
  const laborCost = durationHours * safe(input.hourlyRate);
  const monthlyHours = safe(input.monthlyProductiveHours);
  const allocatedFixedCost = monthlyHours > 0
    ? (safe(input.monthlyFixedCosts) / monthlyHours) * durationHours
    : 0;
  const totalCost = materialCost + laborCost + allocatedFixedCost;
  const fee = Math.min(safe(input.salesFeePercent) / 100, 0.99);
  const margin = Math.min(safe(input.desiredMarginPercent) / 100, 0.95);
  if (fee + margin >= 1) throw new Error("A soma da taxa de venda e da margem precisa ser menor que 100%.");
  const minimumPrice = totalCost / (1 - fee);
  const suggestedPrice = totalCost / (1 - fee - margin);
  const expectedProfit = suggestedPrice - totalCost - suggestedPrice * fee;
  const currentPrice = safe(input.currentPrice ?? 0);
  const currentProfit = currentPrice > 0 ? currentPrice - totalCost - currentPrice * fee : undefined;
  const currentMarginPercent = currentPrice > 0 && currentProfit !== undefined
    ? (currentProfit / currentPrice) * 100
    : undefined;
  return {
    materialCost: cents(materialCost),
    laborCost: cents(laborCost),
    allocatedFixedCost: cents(allocatedFixedCost),
    totalCost: cents(totalCost),
    minimumPrice: cents(minimumPrice),
    suggestedPrice: cents(suggestedPrice),
    expectedProfit: cents(expectedProfit),
    expectedMarginPercent: cents(margin * 100),
    currentProfit: currentProfit === undefined ? undefined : cents(currentProfit),
    currentMarginPercent: currentMarginPercent === undefined ? undefined : cents(currentMarginPercent),
  };
}
