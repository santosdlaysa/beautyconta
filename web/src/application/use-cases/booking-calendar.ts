/**
 * Calendário da agenda pública, no relógio do negócio.
 *
 * O fuso é o ponto delicado desta página: os horários chegam da API no relógio
 * de quem atende, e a cliente pode estar em outro. Se a lista de dias fosse
 * montada com o relógio do aparelho, uma cliente em Roraima abrindo o link de
 * um estúdio em São Paulo veria "hoje" com um dia de diferença perto da
 * meia-noite — e escolheria uma data que a API recusa. Por isso toda data desta
 * página nasce aqui, sempre a partir do fuso que a API informou.
 *
 * As funções recebem o instante por parâmetro em vez de chamar `new Date()`
 * para que o comportamento na virada do dia possa ser verificado em teste.
 */

/**
 * Espelha o horizonte da API, que recusa data além disso.
 *
 * A duplicação é consciente: quem manda é a API, e este número existe só para
 * a página não oferecer o que seria recusado. Se o horizonte mudar lá, aqui
 * fica conservador, nunca permissivo.
 */
export const HORIZON_DAYS = 60;

export type DayOption = {
  /** AAAA-MM-DD, no fuso do negócio. */
  date: string;
  /** Abreviação do dia da semana, como `qua.`. */
  weekday: string;
  /** Dia do mês, como `17`. */
  day: string;
  /** Abreviação do mês, como `set.`. */
  month: string;
};

/** Data de hoje no relógio do negócio, no formato que a API espera. */
export function dateInTimeZone(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

/**
 * Soma dias de calendário.
 *
 * A conta roda em UTC de propósito: somar 24 horas no fuso local erraria por
 * uma hora na virada do horário de verão, e o que se quer aqui é "o próximo dia
 * do calendário", não "daqui a 24 horas".
 */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1) + days * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

/** Quantos dias a régua mostra de uma vez. O resto vai pelo campo de data. */
export const VISIBLE_DAYS = 14;

export type BookingCalendar = {
  days: DayOption[];
  /** Primeiro e último dia que a API aceita, para limitar o campo de data. */
  first: string;
  last: string;
};

/**
 * Calendário pronto para a tela.
 *
 * Montado no servidor, a cada requisição, e entregue como propriedade: se o
 * componente chamasse `new Date()` na montagem, a régua nasceria vazia e
 * apareceria depois — um salto na tela em toda visita, para resolver um
 * descompasso que só existe na virada do dia.
 */
export function buildBookingCalendar(instant: Date, timeZone: string): BookingCalendar {
  return {
    days: buildDayOptions(instant, timeZone, VISIBLE_DAYS),
    first: dateInTimeZone(instant, timeZone),
    last: lastBookableDate(instant, timeZone),
  };
}

/** Os próximos dias que a agenda aceita, começando por hoje no fuso do negócio. */
export function buildDayOptions(instant: Date, timeZone: string, count: number): DayOption[] {
  const today = dateInTimeZone(instant, timeZone);
  const total = Math.min(count, HORIZON_DAYS + 1);

  return Array.from({ length: Math.max(total, 0) }, (_, index) => describeDay(addDays(today, index)));
}

/** Último dia que a API aceita, para limitar o campo de data. */
export function lastBookableDate(instant: Date, timeZone: string): string {
  return addDays(dateInTimeZone(instant, timeZone), HORIZON_DAYS);
}

export function describeDay(date: string): DayOption {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(asUtcDate(date));

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return { date, weekday: value("weekday"), day: value("day"), month: value("month") };
}

/** Data por extenso, como `quarta-feira, 17 de setembro`. */
export function describeDateInFull(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(asUtcDate(date));
}

/**
 * Instante da confirmação por extenso, no relógio do negócio.
 *
 * A confirmação é o único comprovante que a cliente terá, então ela precisa
 * dizer o dia e a hora sem ambiguidade — e no relógio de quem atende, que é o
 * combinado, não no do aparelho dela.
 */
export function describeInstant(startsAt: string, timeZone: string): string {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(startsAt));

  // O separador padrão da locale varia entre implementações; "às" é o que a
  // cliente lê em voz alta ao conferir o comprovante.
  return formatted.replace(/,\s*(\d{2}:\d{2})/, " às $1");
}

/** `1h30`, `45 min`. A duração aparece antes de a cliente escolher o serviço. */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h${String(rest).padStart(2, "0")}`;
}

function asUtcDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
}
