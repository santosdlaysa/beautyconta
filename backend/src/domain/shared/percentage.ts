import { DomainError } from "./domain-error";

/**
 * Percentual guardado como fração decimal: 30% é 0,3.
 *
 * As fórmulas do documento 03 sempre usam a forma decimal. Converter na
 * fronteira evita o erro clássico de dividir por 100 duas vezes.
 */
export class Percentage {
  private constructor(private readonly fraction: number) {}

  static readonly zero = new Percentage(0);

  /**
   * Cria a partir do valor informado pela usuária, em pontos percentuais.
   * `max` é o teto permitido para o campo, conforme a seção 11 do documento 03.
   */
  static fromPercent(value: number, options: { field?: string; max?: number } = {}): Percentage {
    const { field, max = 100 } = options;
    if (!Number.isFinite(value)) {
      throw new DomainError("Percentual inválido.", field);
    }
    if (value < 0) {
      throw new DomainError("Percentual não pode ser negativo.", field);
    }
    if (value > max) {
      throw new DomainError(`Percentual não pode ser maior que ${max}%.`, field);
    }
    return new Percentage(value / 100);
  }

  static fromFraction(fraction: number, field?: string): Percentage {
    return Percentage.fromPercent(fraction * 100, { field });
  }

  toFraction(): number {
    return this.fraction;
  }

  toPercent(): number {
    return this.fraction * 100;
  }

  plus(other: Percentage): Percentage {
    return new Percentage(this.fraction + other.fraction);
  }

  isZero(): boolean {
    return this.fraction === 0;
  }
}
