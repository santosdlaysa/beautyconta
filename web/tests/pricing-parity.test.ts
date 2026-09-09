import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as api from "../../backend/src/domain/pricing/calculate-price";
import * as web from "../src/domain/pricing/calculate-price";

/**
 * Guarda contra a pior falha possível deste repositório: duas fórmulas de
 * dinheiro que divergem em silêncio.
 *
 * A web calcula localmente (ver o cabeçalho de `src/domain/pricing/calculate-price.ts`),
 * então a cópia só é aceitável enquanto este teste provar que ela é a mesma
 * coisa que a API responde. Se alguém corrigir o motor de um lado só, aqui
 * quebra.
 */

const source = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

/** O espelho começa no primeiro `import`; antes dele vive só o aviso de cópia. */
const withoutBanner = (code: string) => code.slice(code.indexOf("import { DomainError }"));

type Case = { name: string; input: web.PricingInput };

const base: web.PricingInput = {
  durationMinutes: 60,
  hourlyRate: 30,
  monthlyFixedCosts: 600,
  monthlyProductiveHours: 120,
  salesFeePercent: 0,
  desiredMarginPercent: 30,
};

const cases: Case[] = [
  { name: "entrada mínima", input: base },
  { name: "custo de material informado direto", input: { ...base, materialCost: 32.5 } },
  { name: "materiais fracionados com perda", input: { ...base, materials: [{ purchasePrice: 90, purchasedQuantity: 24, usedQuantity: 1.5, lossPercent: 10 }, { purchasePrice: 12.9, purchasedQuantity: 100, usedQuantity: 7 }] } },
  { name: "rateio por atendimento", input: { ...base, allocationMethod: "appointment", monthlyAppointments: 60 } },
  { name: "valor da hora vindo da retirada desejada", input: { ...base, hourlyRate: undefined, desiredMonthlyWithdrawal: 5000, productiveDaysPerMonth: 20, productiveHoursPerDay: 5 } },
  { name: "taxa sobre venda do cartão", input: { ...base, salesFeePercent: 3.99 } },
  { name: "taxa alta com margem alta", input: { ...base, salesFeePercent: 12, desiredMarginPercent: 60 } },
  { name: "taxa zero mantém o resultado anterior", input: { ...base, salesFeePercent: 0, currentPrice: 140 } },
  { name: "preço atual no prejuízo", input: { ...base, materialCost: 200, currentPrice: 90, salesFeePercent: 5 } },
  { name: "preço atual igual a zero", input: { ...base, currentPrice: 0 } },
  { name: "outros custos diretos", input: { ...base, otherDirectCosts: 8.75 } },
  { name: "arredondamento comercial em 1", input: { ...base, roundingStrategy: "1" } },
  { name: "arredondamento comercial em 5", input: { ...base, roundingStrategy: "5" } },
  { name: "arredondamento comercial em 10", input: { ...base, roundingStrategy: "10" } },
  { name: "arredondamento terminado em 90", input: { ...base, roundingStrategy: "90" } },
  { name: "margem zero", input: { ...base, desiredMarginPercent: 0 } },
  { name: "margem máxima", input: { ...base, desiredMarginPercent: 95, salesFeePercent: 0 } },
  { name: "duração de um minuto", input: { ...base, durationMinutes: 1 } },
  { name: "duração de vinte e quatro horas", input: { ...base, durationMinutes: 1440 } },
  { name: "sem custo fixo", input: { ...base, monthlyFixedCosts: 0 } },
  { name: "centavos que quebram no arredondamento", input: { ...base, materialCost: 0.005, hourlyRate: 33.333, monthlyFixedCosts: 1000, monthlyProductiveHours: 143, durationMinutes: 155, salesFeePercent: 4.35, desiredMarginPercent: 27 } },
  { name: "números grandes", input: { ...base, materialCost: 99_000_000, monthlyFixedCosts: 99_000_000 } },
];

const invalidCases: Case[] = [
  { name: "duração fora da faixa", input: { ...base, durationMinutes: 0 } },
  { name: "duração acima de um dia", input: { ...base, durationMinutes: 1441 } },
  { name: "taxa somada à margem chega a 100%", input: { ...base, salesFeePercent: 40, desiredMarginPercent: 60 } },
  { name: "custo fixo negativo", input: { ...base, monthlyFixedCosts: -1 } },
  { name: "margem acima do teto", input: { ...base, desiredMarginPercent: 96 } },
  { name: "horas produtivas em zero", input: { ...base, monthlyProductiveHours: 0 } },
  { name: "rateio por atendimento sem quantidade", input: { ...base, allocationMethod: "appointment" } },
  { name: "valor não numérico", input: { ...base, hourlyRate: Number.NaN } },
];

describe("paridade entre o motor da web e o da API", () => {
  it("mantém o arquivo idêntico ao da API, fora o aviso de cópia", () => {
    expect(withoutBanner(source("../src/domain/pricing/calculate-price.ts"))).toBe(
      source("../../backend/src/domain/pricing/calculate-price.ts"),
    );
  });

  it("mantém o erro de domínio idêntico ao da API", () => {
    expect(source("../src/domain/shared/domain-error.ts")).toBe(
      source("../../backend/src/domain/shared/domain-error.ts"),
    );
  });

  it.each(cases)("devolve o mesmo resultado da API: $name", ({ input }) => {
    expect(web.calculatePrice(input)).toStrictEqual(api.calculatePrice(input));
  });

  it.each(invalidCases)("recusa a mesma entrada que a API recusa: $name", ({ input }) => {
    let apiError: unknown;
    let webError: unknown;
    expect(() => api.calculatePrice(input)).toThrow();
    try {
      api.calculatePrice(input);
    } catch (error) {
      apiError = error;
    }
    expect(() => web.calculatePrice(input)).toThrow();
    try {
      web.calculatePrice(input);
    } catch (error) {
      webError = error;
    }
    expect((webError as Error).message).toBe((apiError as Error).message);
    expect((webError as { field?: string }).field).toBe((apiError as { field?: string }).field);
  });

  it("projeta a meta igual à API", () => {
    const goal = { totalCost: 120, monthlyProfitGoal: 3000, monthlyAppointments: 60, salesFeePercent: 4.5 };
    expect(web.calculateGoalPrice(goal)).toStrictEqual(api.calculateGoalPrice(goal));
  });
});
