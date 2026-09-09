import { describe, expect, it } from "vitest";
import {
  HORIZON_DAYS,
  addDays,
  buildDayOptions,
  dateInTimeZone,
  describeInstant,
  formatDuration,
  lastBookableDate,
} from "../src/application/use-cases/booking-calendar";
import { firstInvalidField } from "../src/application/use-cases/validate-booking-form";

/**
 * O fuso é o erro silencioso desta página: a cliente pode estar em outro
 * estado, e a agenda é sempre a do relógio de quem atende. Um dia de diferença
 * perto da meia-noite faz a cliente escolher uma data que a API recusa, sem que
 * nada na tela explique por quê.
 */

describe("data no relógio do negócio", () => {
  it("usa o fuso do negócio, e não o do aparelho", () => {
    // 03:00 UTC de 18/09 ainda é dia 17 em São Paulo (UTC-3).
    const instante = new Date("2026-09-18T02:30:00.000Z");

    expect(dateInTimeZone(instante, "America/Sao_Paulo")).toBe("2026-09-17");
    expect(dateInTimeZone(instante, "America/Boa_Vista")).toBe("2026-09-17");
    expect(dateInTimeZone(instante, "UTC")).toBe("2026-09-18");
  });

  it("soma dias de calendário, e não blocos de 24 horas", () => {
    expect(addDays("2026-09-17", 1)).toBe("2026-09-18");
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-09-17", 0)).toBe("2026-09-17");
  });
});

describe("régua de dias", () => {
  const instante = new Date("2026-09-17T12:00:00.000Z");

  it("começa em hoje, no fuso do negócio, e segue em sequência", () => {
    const dias = buildDayOptions(instante, "America/Sao_Paulo", 3);

    expect(dias.map((dia) => dia.date)).toStrictEqual(["2026-09-17", "2026-09-18", "2026-09-19"]);
    expect(dias[0]?.day).toBe("17");
  });

  it("nunca oferece além do horizonte que a API aceita", () => {
    const dias = buildDayOptions(instante, "America/Sao_Paulo", 500);

    expect(dias).toHaveLength(HORIZON_DAYS + 1);
    expect(dias.at(-1)?.date).toBe(lastBookableDate(instante, "America/Sao_Paulo"));
  });
});

describe("comprovante", () => {
  it("mostra a hora no relógio do negócio, não no de quem abriu a página", () => {
    const texto = describeInstant("2026-09-17T13:00:00.000Z", "America/Sao_Paulo");

    expect(texto).toContain("10:00");
    expect(texto).toContain("17 de setembro");
    expect(texto).toContain("às");
  });
});

describe("duração", () => {
  it.each([
    [45, "45 min"],
    [60, "1h"],
    [90, "1h30"],
    [125, "2h05"],
    [180, "3h"],
  ])("mostra %i minutos como %s", (minutos, esperado) => {
    expect(formatDuration(minutos)).toBe(esperado);
  });
});

describe("dados da cliente", () => {
  it("aceita telefone escrito do jeito que a pessoa escreve", () => {
    for (const telefone of ["95 99999-0000", "(95) 99999-0000", "9599999 0000", "+55 95 99999-0000"]) {
      expect(firstInvalidField({ clientName: "Ana", clientPhone: telefone })).toBeNull();
    }
  });

  it("recusa nome vazio e telefone sem DDD, apontando o campo", () => {
    expect(firstInvalidField({ clientName: "   ", clientPhone: "95 99999-0000" })).toMatchObject({
      field: "clientName",
    });
    expect(firstInvalidField({ clientName: "Ana", clientPhone: "99999000" })).toMatchObject({
      field: "clientPhone",
    });
  });
});
