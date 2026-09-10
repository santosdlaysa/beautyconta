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

export type CalendarDay = {
  /** AAAA-MM-DD, no fuso do negócio. */
  date: string;
  /** Dia do mês, como `17`. */
  day: string;
  /** Se a agenda aceita esta data: nem passado, nem além do horizonte. */
  selectable: boolean;
};

/** Uma semana do calendário. `null` é dia de outro mês, desenhado em branco. */
export type CalendarWeek = (CalendarDay | null)[];

/**
 * Cabeçalho do calendário, começando no domingo.
 *
 * Fixo em vez de derivado da locale porque a grade também começa no domingo:
 * se um viesse da locale e o outro não, o número cairia na coluna errada.
 */
export const WEEKDAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

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

export type BookingCalendar = {
  /** Mês que a grade abre, `AAAA-MM`, no fuso do negócio. */
  month: string;
  /** Primeiro e último dia que a API aceita, para limitar a navegação. */
  first: string;
  last: string;
};

/**
 * Calendário pronto para a tela.
 *
 * Montado no servidor, a cada requisição, e entregue como propriedade: se o
 * componente chamasse `new Date()` na montagem, a grade nasceria vazia e
 * apareceria depois — um salto na tela em toda visita, para resolver um
 * descompasso que só existe na virada do dia.
 */
export function buildBookingCalendar(instant: Date, timeZone: string): BookingCalendar {
  const today = dateInTimeZone(instant, timeZone);

  return { month: monthOf(today), first: today, last: lastBookableDate(instant, timeZone) };
}

/** Último dia que a API aceita, para limitar a navegação. */
export function lastBookableDate(instant: Date, timeZone: string): string {
  return addDays(dateInTimeZone(instant, timeZone), HORIZON_DAYS);
}

/** `AAAA-MM` da data. Comparação de mês é comparação de texto neste formato. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Soma meses ao `AAAA-MM`, virando o ano quando precisa. */
export function addMonths(month: string, count: number): string {
  const [year, index] = month.split("-").map(Number);
  const total = (year ?? 0) * 12 + ((index ?? 1) - 1) + count;

  return `${String(Math.floor(total / 12)).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** `setembro de 2026`, para o cabeçalho da grade. */
export function describeMonth(month: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    asUtcDate(`${month}-01`),
  );
}

/**
 * A grade do mês, em semanas de domingo a sábado.
 *
 * As casas antes do dia 1 e depois do último ficam `null` em vez de mostrarem
 * os dias do mês vizinho: dia clicável de outro mês trocaria o mês exibido sob
 * o dedo de quem só quis marcar, e a agenda já tem as setas para isso.
 *
 * `selectable` sai daqui, e não da tela, porque é a mesma regra que a API
 * aplica: passado não se marca, e o horizonte tem fim. Oferecer o que seria
 * recusado é pior do que não oferecer.
 */
export function buildMonthGrid(
  month: string,
  bounds: { first: string; last: string },
): CalendarWeek[] {
  const primeiro = `${month}-01`;
  const inicio = weekdayIndex(primeiro);
  const total = daysInMonth(month);

  const semanas: CalendarWeek[] = [];
  for (let casa = 0; casa < inicio + total; casa += 1) {
    if (casa % 7 === 0) semanas.push([]);

    const dia = casa - inicio + 1;
    semanas[semanas.length - 1]?.push(
      dia < 1 ? null : describeCalendarDay(`${month}-${String(dia).padStart(2, "0")}`, bounds),
    );
  }

  // A última semana quase nunca fecha no sábado; sem isso a grade perde as
  // colunas que faltam e os dias escorregam para a esquerda.
  const ultima = semanas[semanas.length - 1];
  while (ultima && ultima.length < 7) ultima.push(null);

  return semanas;
}

function describeCalendarDay(date: string, bounds: { first: string; last: string }): CalendarDay {
  return {
    date,
    day: String(Number(date.slice(8))),
    selectable: date >= bounds.first && date <= bounds.last,
  };
}

/** Dia da semana, 0 para domingo. Em UTC, como todo o resto deste módulo. */
function weekdayIndex(date: string): number {
  return asUtcDate(date).getUTCDay();
}

function daysInMonth(month: string): number {
  const [year, index] = month.split("-").map(Number);
  // Dia zero do mês seguinte é o último do mês pedido, inclusive em fevereiro.
  return new Date(Date.UTC(year ?? 0, index ?? 1, 0)).getUTCDate();
}

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
