import { describe, expect, it } from "vitest";
import { calculatePrice, type PricingInput } from "../../src/domain/pricing/calculate-price";
import { simulateGoal } from "../../src/domain/pricing/goal";
import { DomainError } from "../../src/domain/shared";

/**
 * Suíte obrigatória da seção 12 do documento 03, exigida pelo item A-06.
 *
 * São onze casos nomeados no documento, e cada `describe` daqui corresponde a
 * um deles. O exemplo completo da seção 8 fica no teste HTTP, como regressão da
 * ponta a ponta.
 */

/** Base mínima válida: sem material, sem custo fixo, sem taxa e sem margem. */
const base: PricingInput = {
  durationMinutes: 60,
  hourlyRate: 0,
  monthlyFixedCosts: 0,
  monthlyProductiveHours: 100,
  salesFeePercent: 0,
  desiredMarginPercent: 0,
};

describe("material fracionado e múltiplos materiais", () => {
  it("soma o consumo proporcional de cada item", () => {
    const result = calculatePrice({
      ...base,
      materials: [
        // 90 reais por 30 g, usando 10 g.
        { purchasePrice: 90, purchasedQuantity: 30, usedQuantity: 10 },
        // 20 reais por 100 unidades, usando 5.
        { purchasePrice: 20, purchasedQuantity: 100, usedQuantity: 5 },
        // 50 reais por 2 litros, usando meio litro.
        { purchasePrice: 50, purchasedQuantity: 2, usedQuantity: 0.5 },
      ],
    });

    expect(result.materials).toEqual([30, 1, 12.5]);
    expect(result.materialCost).toBe(43.5);
  });

  it("aceita consumo zero sem quebrar a conta", () => {
    const result = calculatePrice({
      ...base,
      materials: [{ purchasePrice: 90, purchasedQuantity: 30, usedQuantity: 0 }],
    });

    expect(result.materialCost).toBe(0);
  });
});

describe("perda de material", () => {
  it("acrescenta o percentual de perda ao consumo", () => {
    const result = calculatePrice({
      ...base,
      materials: [
        { purchasePrice: 100, purchasedQuantity: 10, usedQuantity: 1, lossPercent: 20 },
      ],
    });

    // 10 reais de consumo, mais 20% de perda.
    expect(result.materialCost).toBe(12);
  });
});

describe("duração com minutos quebrados", () => {
  it("cobra a fração exata da hora, sem arredondar para cima", () => {
    const result = calculatePrice({ ...base, durationMinutes: 37, hourlyRate: 60 });

    // 37 minutos a 60 reais a hora.
    expect(result.laborCost).toBe(37);
  });

  it("mantém a proporção no rateio por hora produtiva", () => {
    const result = calculatePrice({
      ...base,
      durationMinutes: 90,
      monthlyFixedCosts: 1_200,
      monthlyProductiveHours: 120,
    });

    // 10 reais por hora produtiva, por uma hora e meia.
    expect(result.allocatedFixedCost).toBe(15);
  });
});

describe("rateio por hora e por atendimento", () => {
  const comCustoFixo = {
    ...base,
    durationMinutes: 150,
    monthlyFixedCosts: 1_200,
    monthlyProductiveHours: 150,
    monthlyAppointments: 60,
  };

  it("rateia por hora produtiva quando é o método escolhido", () => {
    const result = calculatePrice({ ...comCustoFixo, allocationMethod: "productive_hour" });

    expect(result.allocatedFixedCost).toBe(20);
    expect(result.allocationMethod).toBe("productive_hour");
  });

  it("rateia por atendimento quando é o método escolhido", () => {
    const result = calculatePrice({ ...comCustoFixo, allocationMethod: "appointment" });

    expect(result.allocatedFixedCost).toBe(20);
    expect(result.allocationMethod).toBe("appointment");
  });

  it("usa hora produtiva por padrão e declara qual método aplicou", () => {
    expect(calculatePrice(comCustoFixo).allocationMethod).toBe("productive_hour");
  });

  it("recusa rateio por atendimento sem atendimentos estimados", () => {
    expect(() =>
      calculatePrice({ ...base, allocationMethod: "appointment", monthlyFixedCosts: 1_200 }),
    ).toThrowError(DomainError);
  });
});

describe("margem zero", () => {
  it("devolve preço igual ao custo, sem lucro e sem erro", () => {
    const result = calculatePrice({ ...base, hourlyRate: 100, desiredMarginPercent: 0 });

    expect(result.totalCost).toBe(100);
    expect(result.minimumPrice).toBe(100);
    expect(result.suggestedPrice).toBe(100);
    expect(result.expectedProfit).toBe(0);
    expect(result.expectedMarginPercent).toBe(0);
  });
});

describe("taxa de pagamento", () => {
  it("embute a taxa no preço mínimo em vez de descontá-la do custo", () => {
    const result = calculatePrice({ ...base, hourlyRate: 80, salesFeePercent: 20 });

    // 80 de custo com 20% de taxa: 100 é o preço que devolve 80 líquidos.
    expect(result.totalCost).toBe(80);
    expect(result.minimumPrice).toBe(100);
    expect(result.expectedProfit).toBe(0);
  });

  it("desconta a taxa também do lucro esperado", () => {
    const result = calculatePrice({
      ...base,
      hourlyRate: 80,
      salesFeePercent: 20,
      desiredMarginPercent: 20,
    });

    // 80 / (1 - 0,2 - 0,2) = 133,33.
    expect(result.suggestedPrice).toBe(133.33);
    // O lucro sai do preço já arredondado, não do valor cheio: 133,33 menos 80
    // de custo, menos 26,666 de taxa. Os centavos perdidos no arredondamento
    // saem do lucro, nunca do custo — é o lado seguro de errar.
    expect(result.expectedProfit).toBe(26.66);
  });
});

describe("taxa mais margem inválida", () => {
  it("recusa a soma igual a 100% explicando o campo", () => {
    expect(() =>
      calculatePrice({ ...base, salesFeePercent: 50, desiredMarginPercent: 50 }),
    ).toThrowError(/taxa de venda e da margem precisa ser menor que 100/);
  });

  it("recusa a soma acima de 100%", () => {
    expect(() =>
      calculatePrice({ ...base, salesFeePercent: 60, desiredMarginPercent: 45 }),
    ).toThrowError(DomainError);
  });

  it("aceita a soma logo abaixo do limite", () => {
    const result = calculatePrice({
      ...base,
      hourlyRate: 99,
      salesFeePercent: 50,
      desiredMarginPercent: 45,
    });

    expect(result.suggestedPrice).toBeGreaterThan(0);
    expect(Number.isFinite(result.suggestedPrice)).toBe(true);
  });
});

describe("preço atual abaixo do custo", () => {
  it("mostra prejuízo em vez de esconder o número", () => {
    const result = calculatePrice({
      ...base,
      hourlyRate: 100,
      desiredMarginPercent: 30,
      currentPrice: 80,
    });

    expect(result.currentProfit).toBe(-20);
    expect(result.currentMarginPercent).toBe(-25);
    // O preço recomendado continua sendo calculado normalmente.
    expect(result.suggestedPrice).toBe(142.86);
  });

  it("desconta a taxa ao avaliar o preço atual", () => {
    const result = calculatePrice({
      ...base,
      hourlyRate: 100,
      salesFeePercent: 10,
      currentPrice: 100,
    });

    // 100 de venda, menos 100 de custo, menos 10 de taxa.
    expect(result.currentProfit).toBe(-10);
  });
});

describe("arredondamento para cada estratégia", () => {
  /** Exemplo da seção 8: custo 120, margem 30%, recomendado 171,43. */
  const exemplo: PricingInput = {
    materials: [{ purchasePrice: 90, purchasedQuantity: 30, usedQuantity: 10 }],
    durationMinutes: 150,
    hourlyRate: 28,
    monthlyFixedCosts: 1_200,
    monthlyProductiveHours: 150,
    salesFeePercent: 0,
    desiredMarginPercent: 30,
  };

  it("sem arredondamento adicional", () => {
    const result = calculatePrice({ ...exemplo, roundingStrategy: "none" });
    expect(result.commercialPrice).toBe(171.43);
  });

  it("próximo múltiplo de 1", () => {
    expect(calculatePrice({ ...exemplo, roundingStrategy: "1" }).commercialPrice).toBe(172);
  });

  it("próximo múltiplo de 5", () => {
    expect(calculatePrice({ ...exemplo, roundingStrategy: "5" }).commercialPrice).toBe(175);
  });

  it("próximo múltiplo de 10", () => {
    expect(calculatePrice({ ...exemplo, roundingStrategy: "10" }).commercialPrice).toBe(180);
  });

  it("final em noventa", () => {
    expect(calculatePrice({ ...exemplo, roundingStrategy: "90" }).commercialPrice).toBe(171.9);
  });

  it("arredonda sempre para cima, nunca reduzindo a margem desejada", () => {
    for (const strategy of ["1", "5", "10", "90"] as const) {
      const result = calculatePrice({ ...exemplo, roundingStrategy: strategy });
      expect(result.commercialPrice).toBeGreaterThanOrEqual(result.suggestedPrice);
    }
  });

  it("expõe o valor calculado ao lado do comercial", () => {
    const result = calculatePrice({ ...exemplo, roundingStrategy: "10" });

    expect(result.suggestedPrice).toBe(171.43);
    expect(result.commercialPrice).toBe(180);
    // O lucro esperado acompanha o preço que será cobrado, não o calculado.
    expect(result.expectedProfit).toBe(60);
  });
});

describe("valores monetários grandes", () => {
  it("mantém a precisão no limite operacional documentado", () => {
    const result = calculatePrice({
      ...base,
      materialCost: 90_000_000,
      desiredMarginPercent: 50,
    });

    expect(result.totalCost).toBe(90_000_000);
    expect(result.suggestedPrice).toBe(180_000_000);
    expect(Number.isFinite(result.suggestedPrice)).toBe(true);
  });

  it("recusa entrada acima do limite em vez de estourar em silêncio", () => {
    expect(() => calculatePrice({ ...base, materialCost: 100_000_001 })).toThrowError(
      DomainError,
    );
  });
});

describe("resultado histórico imutável", () => {
  it("carrega a versão da fórmula em todo resultado", () => {
    expect(calculatePrice(base).calculationVersion).toBe(1);
    expect(simulateGoal({ totalCost: 100, monthlyProfitGoal: 1_000, monthlyAppointments: 10 })
      .calculationVersion).toBe(1);
  });

  it("não muda quando a entrada que o originou é alterada depois", () => {
    const input: PricingInput = { ...base, hourlyRate: 100 };
    const antes = calculatePrice(input);

    input.hourlyRate = 200;
    const depois = calculatePrice(input);

    // O primeiro resultado é uma fotografia: continua valendo o que valia.
    expect(antes.laborCost).toBe(100);
    expect(depois.laborCost).toBe(200);
  });

  it("devolve resultado novo a cada chamada, sem estado compartilhado", () => {
    const primeiro = calculatePrice({ ...base, hourlyRate: 100 });
    const segundo = calculatePrice({ ...base, hourlyRate: 50 });

    expect(primeiro.laborCost).toBe(100);
    expect(segundo.laborCost).toBe(50);
    expect(primeiro).not.toBe(segundo);
  });
});

/** Seção 10 e item A-04: a meta é projeção, e precisa dizer isso. */
describe("simulador de meta", () => {
  it("divide a meta pelos atendimentos e projeta o preço", () => {
    const result = simulateGoal({
      totalCost: 120,
      monthlyProfitGoal: 2_000,
      monthlyAppointments: 40,
    });

    expect(result.profitPerAppointment).toBe(50);
    expect(result.projectedPrice).toBe(170);
    expect(result.disclaimer).toMatch(/não é garantia/i);
  });

  it("embute a taxa sobre venda no preço projetado", () => {
    const result = simulateGoal({
      totalCost: 120,
      monthlyProfitGoal: 2_000,
      monthlyAppointments: 40,
      salesFeePercent: 20,
    });

    // (120 + 50) / (1 - 0,2).
    expect(result.projectedPrice).toBe(212.5);
  });

  it("responde quantos atendimentos a meta exige no preço atual", () => {
    const result = simulateGoal({
      totalCost: 100,
      monthlyProfitGoal: 1_000,
      monthlyAppointments: 40,
      currentPrice: 150,
    });

    // 50 de lucro por atendimento, para uma meta de mil.
    expect(result.appointmentsNeededAtCurrentPrice).toBe(20);
  });

  it("arredonda para cima: meio atendimento não existe", () => {
    const result = simulateGoal({
      totalCost: 100,
      monthlyProfitGoal: 1_000,
      monthlyAppointments: 40,
      currentPrice: 130,
    });

    // 30 de lucro por atendimento: 33,33 vira 34.
    expect(result.appointmentsNeededAtCurrentPrice).toBe(34);
  });

  it("não inventa número quando o preço atual não cobre o custo", () => {
    const result = simulateGoal({
      totalCost: 100,
      monthlyProfitGoal: 1_000,
      monthlyAppointments: 40,
      currentPrice: 90,
    });

    expect(result.appointmentsNeededAtCurrentPrice).toBeNull();
  });

  it("recusa atendimentos mensais iguais a zero", () => {
    expect(() =>
      simulateGoal({ totalCost: 100, monthlyProfitGoal: 1_000, monthlyAppointments: 0 }),
    ).toThrowError(DomainError);
  });
});
