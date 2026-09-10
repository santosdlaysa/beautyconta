import type { Notifier } from "../ports/notifications";
import type { Clock, MetricsRepository } from "../ports/repositories";

/**
 * Relatório diário para quem cuida do produto.
 *
 * O corte do dia é o de Brasília, e não o do servidor: a hospedagem roda em
 * UTC, onde "hoje" vira à meia-noite de Londres — um cadastro feito às 22h no
 * Brasil já contaria como do dia seguinte, e o relatório da manhã sairia sempre
 * com o número errado.
 */
export class SendDailyReport {
  constructor(
    private readonly metrics: MetricsRepository,
    private readonly notifier: Notifier,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<void> {
    const snapshot = await this.metrics.snapshot(startOfDayInBrasilia(this.clock.now()));
    await this.notifier.notify({ kind: "daily_report", metrics: snapshot });
  }
}

/**
 * Início do dia corrente no fuso de Brasília, devolvido em UTC.
 *
 * O deslocamento sai do próprio `Intl` em vez de um `-3` fixo: fuso é decisão
 * política e já mudou no Brasil — o horário de verão acabou em 2019 e pode
 * voltar. Um número cravado no código erraria uma hora no dia em que voltasse.
 */
export function startOfDayInBrasilia(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string): number => Number(parts.find((part) => part.type === type)?.value ?? 0);

  // Quanto o relógio de Brasília está atrás do UTC neste instante.
  const localAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second"),
  );
  const offset = localAsUtc - Math.floor(now.getTime() / 1000) * 1000;

  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")) - offset);
}
