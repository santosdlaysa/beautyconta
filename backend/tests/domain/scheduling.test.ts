import { describe, expect, it } from "vitest";
import {
  availableSlots,
  formatTime,
  isSlotAvailable,
  parseTime,
} from "../../src/domain/scheduling/availability";
import {
  utcToZoned,
  weekdayOf,
  zonedTimeToUtc,
} from "../../src/domain/scheduling/timezone";
import { DomainError } from "../../src/domain/shared";

/** Expediente das 9h às 12h e das 14h às 18h. */
const expediente = [
  { startMinute: 9 * 60, endMinute: 12 * 60 },
  { startMinute: 14 * 60, endMinute: 18 * 60 },
];

describe("horários livres", () => {
  it("oferece começos de quinze em quinze minutos dentro do expediente", () => {
    const slots = availableSlots({ workingHours: expediente, busy: [], durationMinutes: 60 });

    expect(formatTime(slots[0] as number)).toBe("09:00");
    expect(formatTime(slots[1] as number)).toBe("09:15");
    // O último da manhã começa às 11:00 e termina às 12:00, em cima do fim.
    expect(slots.map(formatTime)).toContain("11:00");
    expect(slots.map(formatTime)).not.toContain("11:15");
  });

  it("não oferece horário cujo atendimento passaria do fim do expediente", () => {
    const slots = availableSlots({ workingHours: expediente, busy: [], durationMinutes: 120 });

    // Duas horas a partir das 10:00 encostam no almoço; 10:15 já invadiria.
    expect(slots.map(formatTime)).toContain("10:00");
    expect(slots.map(formatTime)).not.toContain("10:15");
  });

  it("descarta o que colide com atendimento já marcado", () => {
    const slots = availableSlots({
      workingHours: expediente,
      busy: [{ startMinute: 10 * 60, endMinute: 11 * 60 }],
      durationMinutes: 60,
    });

    const rotulos = slots.map(formatTime);

    expect(rotulos).not.toContain("09:30"); // terminaria dentro do ocupado
    expect(rotulos).not.toContain("10:00");
    expect(rotulos).not.toContain("10:45");
    expect(rotulos).toContain("09:00"); // termina exatamente às 10:00
    expect(rotulos).toContain("11:00"); // começa exatamente ao fim do ocupado
  });

  it("encaixa serviço curto na fresta entre dois atendimentos", () => {
    const slots = availableSlots({
      workingHours: [{ startMinute: 9 * 60, endMinute: 12 * 60 }],
      busy: [
        { startMinute: 9 * 60, endMinute: 10 * 60 },
        { startMinute: 10 * 60 + 30, endMinute: 12 * 60 },
      ],
      durationMinutes: 30,
    });

    expect(slots.map(formatTime)).toEqual(["10:00"]);
  });

  it("esconde o que já passou quando a data é hoje", () => {
    const slots = availableSlots({
      workingHours: expediente,
      busy: [],
      durationMinutes: 60,
      nowMinute: 10 * 60,
    });

    expect(slots.map(formatTime)).not.toContain("09:00");
    expect(slots.map(formatTime)).toContain("10:15");
  });

  it("respeita a antecedência mínima", () => {
    const slots = availableSlots({
      workingHours: expediente,
      busy: [],
      durationMinutes: 60,
      nowMinute: 10 * 60,
      leadTimeMinutes: 60,
    });

    // Com uma hora de antecedência, nada antes das 11:00 é oferecido.
    expect(slots.map(formatTime)).not.toContain("10:45");
    expect(slots.map(formatTime)).toContain("11:00");
  });

  it("devolve lista vazia quando o dia não tem expediente", () => {
    expect(availableSlots({ workingHours: [], busy: [], durationMinutes: 60 })).toEqual([]);
  });

  it("recusa duração inválida em vez de devolver lista errada", () => {
    expect(() =>
      availableSlots({ workingHours: expediente, busy: [], durationMinutes: 0 }),
    ).toThrowError(DomainError);
  });

  it("não repete horário quando as faixas se sobrepõem", () => {
    const slots = availableSlots({
      workingHours: [
        { startMinute: 9 * 60, endMinute: 11 * 60 },
        { startMinute: 10 * 60, endMinute: 12 * 60 },
      ],
      busy: [],
      durationMinutes: 60,
    });

    expect(new Set(slots).size).toBe(slots.length);
    expect(slots).toEqual([...slots].sort((a, b) => a - b));
  });

  it("confere de novo o horário escolhido, contra o estado do momento", () => {
    const base = { workingHours: expediente, durationMinutes: 60, startMinute: 10 * 60 };

    expect(isSlotAvailable({ ...base, busy: [] })).toBe(true);
    // Outra pessoa pegou o horário entre ver a lista e confirmar.
    expect(
      isSlotAvailable({ ...base, busy: [{ startMinute: 10 * 60, endMinute: 11 * 60 }] }),
    ).toBe(false);
  });
});

describe("horário e formato", () => {
  it("converte nos dois sentidos", () => {
    expect(parseTime("08:30")).toBe(510);
    expect(formatTime(510)).toBe("08:30");
    expect(parseTime("00:00")).toBe(0);
    expect(formatTime(0)).toBe("00:00");
  });

  it("recusa formato inválido em vez de adivinhar", () => {
    for (const invalido of ["8:30", "24:00", "12:60", "meio-dia", ""]) {
      expect(() => parseTime(invalido)).toThrowError(DomainError);
    }
  });
});

/**
 * Fuso: é aqui que a agenda pública erra sem avisar. Um deslocamento de três
 * horas não quebra nada — só faz a cliente aparecer na hora errada.
 */
describe("fuso do negócio", () => {
  const SP = "America/Sao_Paulo";

  it("converte o relógio do negócio para o instante real", () => {
    // Brasília está três horas atrás de UTC.
    const instante = zonedTimeToUtc("2026-09-10", 14 * 60, SP);
    expect(instante.toISOString()).toBe("2026-09-10T17:00:00.000Z");
  });

  it("volta do instante real para o relógio do negócio", () => {
    const { date, minute } = utcToZoned(new Date("2026-09-10T17:00:00.000Z"), SP);

    expect(date).toBe("2026-09-10");
    expect(formatTime(minute)).toBe("14:00");
  });

  it("fecha o ciclo em qualquer horário do dia", () => {
    for (const minuto of [0, 1, 7 * 60 + 45, 12 * 60, 23 * 60 + 59]) {
      const instante = zonedTimeToUtc("2026-03-15", minuto, SP);
      expect(utcToZoned(instante, SP)).toEqual({ date: "2026-03-15", minute: minuto });
    }
  });

  it("usa a regra do fuso vigente na data, e não na de hoje", () => {
    // Um fuso que ainda pratica horário de verão: em julho o deslocamento de
    // Lisboa é de uma hora; em janeiro, nenhum.
    const verao = zonedTimeToUtc("2026-07-15", 12 * 60, "Europe/Lisbon");
    const inverno = zonedTimeToUtc("2026-01-15", 12 * 60, "Europe/Lisbon");

    expect(verao.toISOString()).toBe("2026-07-15T11:00:00.000Z");
    expect(inverno.toISOString()).toBe("2026-01-15T12:00:00.000Z");
  });

  it("descobre o dia da semana no fuso certo", () => {
    // 2026-09-10 é uma quinta-feira.
    expect(weekdayOf("2026-09-10", SP)).toBe(4);
    expect(weekdayOf("2026-09-13", SP)).toBe(0);
  });

  it("recusa data em formato inesperado", () => {
    expect(() => zonedTimeToUtc("10/09/2026", 600, SP)).toThrowError(DomainError);
  });
});
