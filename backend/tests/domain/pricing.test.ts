import { describe, expect, it } from "vitest";
import { calculateGoalPrice, calculatePrice } from "../../src/domain/pricing/calculate-price";

const base = { durationMinutes: 60, hourlyRate: 30, monthlyFixedCosts: 600, monthlyProductiveHours: 120, salesFeePercent: 0, desiredMarginPercent: 30 };

describe("motor de precificação", () => {
  it("calcula materiais fracionados e perda", () => {
    const result = calculatePrice({ ...base, materials: [{ purchasePrice: 90, purchasedQuantity: 24, usedQuantity: 1.5, lossPercent: 10 }] });
    expect(result.materialCost).toBe(6.19);
    expect(result.calculationVersion).toBe(1);
  });

  it("rateia custos por atendimento", () => {
    const result = calculatePrice({ ...base, monthlyAppointments: 60, allocationMethod: "appointment" });
    expect(result.allocatedFixedCost).toBe(10);
    expect(result.allocationMethod).toBe("appointment");
  });

  it("arredonda sempre para cima no múltiplo comercial", () => {
    const result = calculatePrice({ ...base, materialCost: 0, roundingStrategy: "5" });
    expect(result.commercialPrice).toBe(50);
    expect(result.commercialPrice).toBeGreaterThanOrEqual(result.suggestedPrice);
  });

  it("calcula valor/hora pela retirada e horas produtivas", () => {
    const result = calculatePrice({ ...base, hourlyRate: undefined, desiredMonthlyWithdrawal: 5000, productiveDaysPerMonth: 20, productiveHoursPerDay: 5 });
    expect(result.hourlyRate).toBe(50);
    expect(result.laborCost).toBe(50);
  });

  it("projeta preço para meta mensal por atendimento", () => {
    expect(calculateGoalPrice({ totalCost: 120, monthlyProfitGoal: 3000, monthlyAppointments: 60, salesFeePercent: 0 }).projectedPrice).toBe(170);
  });
});
