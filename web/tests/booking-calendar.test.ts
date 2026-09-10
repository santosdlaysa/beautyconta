import { describe, expect, it } from "vitest";
import {
  HORIZON_DAYS,
  addDays,
  addMonths,
  buildBookingCalendar,
  buildMonthGrid,
  dateInTimeZone,
  describeInstant,
  describeMonth,
  monthOf,
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

describe("grade do mês", () => {
  const instante = new Date("2026-09-17T12:00:00.000Z");
  const limites = { first: "2026-09-17", last: "2026-11-16" };

  it("abre no mês de hoje, no fuso do negócio", () => {
    // 02:30 UTC de 01/10 ainda é 30 de setembro em São Paulo.
    const virada = new Date("2026-10-01T02:30:00.000Z");

    expect(buildBookingCalendar(virada, "America/Sao_Paulo").month).toBe("2026-09");
    expect(buildBookingCalendar(virada, "UTC").month).toBe("2026-10");
  });

  it("alinha o dia 1 na coluna do dia da semana certo", () => {
    // 1º de setembro de 2026 é uma terça: duas casas vazias antes dele.
    const semanas = buildMonthGrid("2026-09", limites);

    expect(semanas[0]?.slice(0, 2)).toStrictEqual([null, null]);
    expect(semanas[0]?.[2]?.date).toBe("2026-09-01");
  });

  it("fecha toda semana com sete casas", () => {
    for (const mes of ["2026-09", "2026-11", "2027-02", "2028-02"]) {
      for (const semana of buildMonthGrid(mes, limites)) {
        expect(semana).toHaveLength(7);
      }
    }
  });

  it("conta os dias do mês, inclusive em fevereiro bissexto", () => {
    const conta = (mes: string) =>
      buildMonthGrid(mes, limites).flat().filter((dia) => dia !== null).length;

    expect(conta("2026-09")).toBe(30);
    expect(conta("2027-02")).toBe(28);
    expect(conta("2028-02")).toBe(29);
    expect(conta("2026-12")).toBe(31);
  });

  it("não deixa marcar passado nem além do horizonte", () => {
    const dia = (data: string) =>
      buildMonthGrid(monthOf(data), limites)
        .flat()
        .find((casa) => casa?.date === data);

    // Ontem existe na grade, mas apagado: some-lo esconderia a estrutura do mês.
    expect(dia("2026-09-16")?.selectable).toBe(false);
    expect(dia("2026-09-17")?.selectable).toBe(true);
    expect(dia("2026-11-16")?.selectable).toBe(true);
    expect(dia("2026-11-17")?.selectable).toBe(false);
  });

  it("o horizonte da API cabe na navegação de meses", () => {
    const calendario = buildBookingCalendar(instante, "America/Sao_Paulo");

    expect(monthOf(calendario.first)).toBe("2026-09");
    expect(calendario.last).toBe(lastBookableDate(instante, "America/Sao_Paulo"));

    // A grade navega por mês, mas quem manda no fim é o horizonte da API.
    expect(calendario.last).toBe(addDays(calendario.first, HORIZON_DAYS));
  });

  it("vira o ano ao andar de mês", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-09", 0)).toBe("2026-09");
    expect(addMonths("2026-09", 15)).toBe("2027-12");
  });

  it("escreve o mês por extenso, com o ano", () => {
    expect(describeMonth("2026-09")).toContain("setembro");
    expect(describeMonth("2026-09")).toContain("2026");
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
