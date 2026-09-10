import { describe, expect, it } from "vitest";
import {
  assertValidEquipment,
  isReserveComplete,
  monthlyReserveCents,
  monthsSince,
  totalMonthlyReserveCents,
} from "../../src/domain/equipment/reserve";
import { DomainError } from "../../src/domain/shared";

const HOJE = new Date("2026-09-10T12:00:00.000Z");

/** Exemplo da seção 5 do documento 07: 1200 em 36 meses dá 33,33 por mês. */
const cabine = {
  acquisitionPriceCents: 120_000,
  residualValueCents: 0,
  usefulLifeMonths: 36,
  acquisitionDate: new Date("2026-01-10T00:00:00.000Z"),
  isArchived: false,
};

describe("reserva mensal", () => {
  it("reproduz o exemplo do documento 07", () => {
    expect(monthlyReserveCents(cabine, HOJE)).toBe(3_333);
  });

  it("desconta o que a usuária espera revender", () => {
    // 2000 de compra, 500 de revenda, 30 meses: guarda-se o desgaste, 1500.
    const reserva = monthlyReserveCents(
      { ...cabine, acquisitionPriceCents: 200_000, residualValueCents: 50_000, usefulLifeMonths: 30 },
      HOJE,
    );

    expect(reserva).toBe(5_000);
  });

  it("para de somar quando a vida útil termina", () => {
    // Comprada há mais de três anos, com três anos de vida útil.
    const vencida = { ...cabine, acquisitionDate: new Date("2022-01-10T00:00:00.000Z") };

    // Continuar cobrando por ela inflaria o preço para guardar dinheiro que já
    // foi guardado.
    expect(monthlyReserveCents(vencida, HOJE)).toBe(0);
    expect(isReserveComplete(vencida, HOJE)).toBe(true);
  });

  it("conta no último mês e para no seguinte", () => {
    const base = { ...cabine, usefulLifeMonths: 12 };
    const onzeMeses = { ...base, acquisitionDate: new Date("2025-10-10T00:00:00.000Z") };
    const dozeMeses = { ...base, acquisitionDate: new Date("2025-09-10T00:00:00.000Z") };

    expect(monthlyReserveCents(onzeMeses, HOJE)).toBeGreaterThan(0);
    expect(monthlyReserveCents(dozeMeses, HOJE)).toBe(0);
  });

  it("equipamento arquivado não entra na conta", () => {
    expect(monthlyReserveCents({ ...cabine, isArchived: true }, HOJE)).toBe(0);
  });

  it("soma só o que ainda conta", () => {
    const total = totalMonthlyReserveCents(
      [
        cabine,
        { ...cabine, isArchived: true },
        { ...cabine, acquisitionDate: new Date("2020-01-10T00:00:00.000Z") },
      ],
      HOJE,
    );

    expect(total).toBe(3_333);
  });

  it("soma vazia é zero, não erro", () => {
    expect(totalMonthlyReserveCents([], HOJE)).toBe(0);
  });
});

describe("meses desde a compra", () => {
  it("conta mês de calendário, não trinta dias", () => {
    // Quem comprou em 15 de janeiro completou um mês em 15 de fevereiro.
    const compra = new Date("2026-01-15T00:00:00.000Z");

    expect(monthsSince(compra, new Date("2026-02-14T00:00:00.000Z"))).toBe(0);
    expect(monthsSince(compra, new Date("2026-02-15T00:00:00.000Z"))).toBe(1);
    expect(monthsSince(compra, new Date("2027-01-15T00:00:00.000Z"))).toBe(12);
  });

  it("data futura não devolve mês negativo", () => {
    expect(monthsSince(new Date("2027-01-01T00:00:00.000Z"), HOJE)).toBe(0);
  });
});

describe("validação do documento 07", () => {
  const valido = {
    acquisitionPriceCents: 120_000,
    residualValueCents: 0,
    usefulLifeMonths: 36,
    acquisitionDate: new Date("2026-01-10T00:00:00.000Z"),
    now: HOJE,
  };

  it("aceita o que serve", () => {
    expect(() => assertValidEquipment(valido)).not.toThrow();
  });

  it("recusa revenda maior ou igual à compra", () => {
    // Sem desgaste não há o que guardar.
    expect(() =>
      assertValidEquipment({ ...valido, residualValueCents: 120_000 }),
    ).toThrowError(/menor que o de compra/);
  });

  it("recusa vida útil fora da faixa", () => {
    for (const meses of [0, 241, 12.5]) {
      expect(() => assertValidEquipment({ ...valido, usefulLifeMonths: meses })).toThrowError(
        DomainError,
      );
    }
  });

  it("recusa compra no futuro", () => {
    expect(() =>
      assertValidEquipment({ ...valido, acquisitionDate: new Date("2027-01-01T00:00:00.000Z") }),
    ).toThrowError(/futuro/);
  });

  it("recusa valor de compra zerado", () => {
    expect(() => assertValidEquipment({ ...valido, acquisitionPriceCents: 0 })).toThrowError(
      DomainError,
    );
  });
});
