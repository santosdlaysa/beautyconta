import { DomainError } from "../shared/domain-error";

/**
 * Horários livres da agenda pública.
 *
 * Função pura: recebe o expediente, o que já está marcado e a duração do
 * serviço, e devolve os começos possíveis. Não conhece banco, fuso do servidor
 * nem requisição — o que permite testar o caso chato (véspera de feriado,
 * atendimento que atravessa o fim do expediente) sem subir nada.
 *
 * Tudo aqui é **minuto dentro do dia**, contado da meia-noite no fuso do
 * negócio. Converter para instante real é trabalho da borda, e é lá que o fuso
 * entra uma única vez.
 */

/** De quanto em quanto tempo um horário pode começar. */
export const SLOT_STEP_MINUTES = 15;

const MINUTES_IN_DAY = 24 * 60;

export type TimeRange = {
  /** Minutos desde a meia-noite, no fuso do negócio. */
  startMinute: number;
  endMinute: number;
};

export type BusyRange = TimeRange;

export function assertValidRange(range: TimeRange, field = "horario"): void {
  const { startMinute, endMinute } = range;

  if (!Number.isInteger(startMinute) || !Number.isInteger(endMinute)) {
    throw new DomainError("Horário precisa ser informado em minutos inteiros.", field);
  }
  if (startMinute < 0 || endMinute > MINUTES_IN_DAY) {
    throw new DomainError("Horário fora do dia.", field);
  }
  if (endMinute <= startMinute) {
    throw new DomainError("O fim do expediente precisa ser depois do início.", field);
  }
}

/**
 * Começos possíveis para um serviço de `durationMinutes`.
 *
 * Um horário só entra se o atendimento **inteiro** couber: dentro de uma faixa
 * do expediente e sem encostar no que já está marcado. Oferecer um começo que
 * termina depois do expediente seria empurrar para a profissional a decisão de
 * varar a noite.
 *
 * `nowMinute` descarta o que já passou quando a data é hoje — ninguém agenda
 * para as duas da tarde às três.
 */
export function availableSlots(input: {
  workingHours: readonly TimeRange[];
  busy: readonly BusyRange[];
  durationMinutes: number;
  nowMinute?: number;
  /** Antecedência mínima: quanto tempo antes o horário deixa de ser oferecido. */
  leadTimeMinutes?: number;
}): number[] {
  const { workingHours, busy, durationMinutes } = input;

  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new DomainError("A duração do serviço precisa ser maior que zero.", "durationMinutes");
  }

  // Começo mais cedo aceitável. O limite é inclusivo: com uma hora de
  // antecedência às 10:00, as 11:00 valem — é exatamente a hora pedida, e
  // recusá-la faria a antecedência valer uma hora e um minuto.
  const maisCedo =
    input.nowMinute === undefined
      ? Number.NEGATIVE_INFINITY
      : input.nowMinute + (input.leadTimeMinutes ?? 0);

  const livres: number[] = [];

  for (const faixa of workingHours) {
    assertValidRange(faixa, "workingHours");

    const ultimoComeco = faixa.endMinute - durationMinutes;

    for (let inicio = faixa.startMinute; inicio <= ultimoComeco; inicio += SLOT_STEP_MINUTES) {
      if (inicio < maisCedo) continue;

      const fim = inicio + durationMinutes;
      const colide = busy.some((ocupado) => inicio < ocupado.endMinute && fim > ocupado.startMinute);

      if (!colide) livres.push(inicio);
    }
  }

  // Faixas fora de ordem ou sobrepostas não podem gerar horário repetido nem
  // lista embaralhada: a página mostra isso como está.
  return [...new Set(livres)].sort((a, b) => a - b);
}

/**
 * Confere um horário escolhido, e não apenas se ele estava na lista.
 *
 * A lista é mostrada e o agendamento chega depois — no meio, outra pessoa pode
 * ter pegado o mesmo horário. Esta verificação roda de novo no momento de
 * gravar, contra o estado daquele instante.
 */
export function isSlotAvailable(input: {
  workingHours: readonly TimeRange[];
  busy: readonly BusyRange[];
  durationMinutes: number;
  startMinute: number;
  nowMinute?: number;
  leadTimeMinutes?: number;
}): boolean {
  return availableSlots(input).includes(input.startMinute);
}

/** `08:30` para 510. Recusa formato inválido em vez de adivinhar. */
export function parseTime(value: string, field = "horario"): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    throw new DomainError("Use o formato HH:MM, como 08:30.", field);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 510 para `08:30`. */
export function formatTime(minute: number): string {
  const hora = Math.floor(minute / 60);
  const minuto = minute % 60;
  return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
}
