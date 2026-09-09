import { DomainError } from "../shared/domain-error";

/**
 * Conversão entre o relógio do negócio e o instante real.
 *
 * A agenda pública é o primeiro lugar do produto em que o fuso importa de
 * verdade: a cliente escolhe "quinta, 14:00" olhando o relógio dela, o banco
 * guarda um instante em UTC, e o servidor pode estar em qualquer lugar. Errar
 * aqui não dá erro — dá atendimento marcado três horas fora, o que só aparece
 * quando alguém não é atendido.
 *
 * A conversão usa o próprio `Intl` do Node, sem dependência nova, e resolve
 * horário de verão pela regra vigente na data em questão, e não na de hoje.
 */

/** Data no formato `AAAA-MM-DD`, no fuso do negócio. */
export type LocalDate = string;

export function assertLocalDate(value: string, field = "data"): LocalDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DomainError("Use uma data no formato AAAA-MM-DD.", field);
  }
  return value;
}

/**
 * Diferença do fuso em relação ao UTC, em minutos, naquele instante.
 *
 * Calculada comparando o mesmo instante formatado nos dois fusos. É o caminho
 * que o `Intl` permite sem tabela de fusos própria.
 */
function offsetMinutes(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const partes = Object.fromEntries(
    formatter.formatToParts(instant).map((parte) => [parte.type, parte.value]),
  );

  // `24` aparece à meia-noite em algumas combinações de sistema.
  const hora = partes.hour === "24" ? "00" : partes.hour;

  const comoUtc = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(hora),
    Number(partes.minute),
    Number(partes.second),
  );

  return (comoUtc - instant.getTime()) / 60_000;
}

/**
 * Instante real de um horário local.
 *
 * O offset depende do próprio instante que se quer descobrir, então a conta é
 * feita duas vezes: a primeira estima, a segunda corrige. É o suficiente para
 * qualquer fuso real, inclusive nas viradas de horário de verão.
 */
export function zonedTimeToUtc(date: LocalDate, minuteOfDay: number, timeZone: string): Date {
  assertLocalDate(date);

  const [ano, mes, dia] = date.split("-").map(Number) as [number, number, number];
  const comoSeFosseUtc = Date.UTC(ano, mes - 1, dia, 0, minuteOfDay);

  const primeiro = offsetMinutes(new Date(comoSeFosseUtc), timeZone);
  const estimado = new Date(comoSeFosseUtc - primeiro * 60_000);

  const segundo = offsetMinutes(estimado, timeZone);
  if (segundo === primeiro) return estimado;

  return new Date(comoSeFosseUtc - segundo * 60_000);
}

/** Data e minuto do dia, no fuso do negócio, de um instante real. */
export function utcToZoned(instant: Date, timeZone: string): { date: LocalDate; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const partes = Object.fromEntries(
    formatter.formatToParts(instant).map((parte) => [parte.type, parte.value]),
  );

  const hora = partes.hour === "24" ? "00" : partes.hour;

  return {
    date: `${partes.year}-${partes.month}-${partes.day}`,
    minute: Number(hora) * 60 + Number(partes.minute),
  };
}

/** Dia da semana no fuso do negócio: 0 é domingo, como em `Date.getDay`. */
export function weekdayOf(date: LocalDate, timeZone: string): number {
  const meioDia = zonedTimeToUtc(date, 12 * 60, timeZone);
  const nome = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(meioDia);

  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const indice = dias.indexOf(nome);

  if (indice === -1) throw new DomainError("Não foi possível descobrir o dia da semana.");
  return indice;
}
