import { DomainError } from "./domain-error";

/** Limites da seção 11 do documento 03: de 1 minuto a 24 horas. */
const MIN_MINUTES = 1;
const MAX_MINUTES = 1440;

/** Duração de um atendimento, em minutos inteiros. */
export class Duration {
  private constructor(private readonly minutes: number) {}

  static fromMinutes(minutes: number, field = "duracao"): Duration {
    if (!Number.isFinite(minutes) || !Number.isInteger(minutes)) {
      throw new DomainError("A duração precisa ser informada em minutos inteiros.", field);
    }
    if (minutes < MIN_MINUTES) {
      throw new DomainError("A duração precisa ser de pelo menos 1 minuto.", field);
    }
    if (minutes > MAX_MINUTES) {
      throw new DomainError("A duração não pode passar de 24 horas.", field);
    }
    return new Duration(minutes);
  }

  static fromHoursAndMinutes(hours: number, minutes: number, field = "duracao"): Duration {
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      throw new DomainError("Tempo de atendimento inválido.", field);
    }
    return Duration.fromMinutes(Math.round(hours * 60 + minutes), field);
  }

  toMinutes(): number {
    return this.minutes;
  }

  /** Fração de hora usada nas fórmulas de mão de obra e rateio. */
  toHours(): number {
    return this.minutes / 60;
  }
}
