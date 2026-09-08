import { DomainError } from "./domain-error";

/** Maior valor aceito em qualquer campo monetário: R$ 100.000.000,00. */
const MAX_CENTS = 10_000_000_000;

/**
 * Valor monetário em centavos inteiros.
 *
 * O produto calcula preço de venda. Ponto flutuante binário não representa
 * 0,1 exatamente, então nenhuma operação daqui usa `number` fracionário: o
 * estado interno é sempre um inteiro de centavos.
 */
export class Money {
  private constructor(private readonly cents: number) {}

  static readonly zero = new Money(0);

  /** Cria a partir de centavos inteiros. */
  static fromCents(cents: number): Money {
    if (!Number.isFinite(cents) || !Number.isInteger(cents)) {
      throw new DomainError("Valor monetário precisa ser um número inteiro de centavos.");
    }
    if (Math.abs(cents) > MAX_CENTS) {
      throw new DomainError("Valor monetário acima do limite aceito pelo sistema.");
    }
    return new Money(cents);
  }

  /**
   * Cria a partir de reais informados pela usuária. O arredondamento para
   * centavos acontece aqui, na fronteira, e em nenhum outro lugar.
   */
  static fromReais(amount: number): Money {
    if (!Number.isFinite(amount)) {
      throw new DomainError("Valor monetário inválido.");
    }
    return Money.fromCents(Math.round(amount * 100));
  }

  toCents(): number {
    return this.cents;
  }

  /** Somente para exibição e serialização de borda, nunca para cálculo. */
  toReais(): number {
    return this.cents / 100;
  }

  plus(other: Money): Money {
    return Money.fromCents(this.cents + other.cents);
  }

  minus(other: Money): Money {
    return Money.fromCents(this.cents - other.cents);
  }

  /**
   * Multiplica por um fator adimensional, como horas ou quantidade de uso.
   * O resultado é arredondado para o centavo mais próximo.
   */
  times(factor: number): Money {
    if (!Number.isFinite(factor)) {
      throw new DomainError("Fator de multiplicação inválido.");
    }
    return Money.fromCents(Math.round(this.cents * factor));
  }

  /**
   * Divide por um fator adimensional. Usado no rateio de custos fixos e no
   * custo unitário de material.
   */
  dividedBy(factor: number): Money {
    if (!Number.isFinite(factor) || factor === 0) {
      throw new DomainError("Divisão monetária por zero ou por valor inválido.");
    }
    return Money.fromCents(Math.round(this.cents / factor));
  }

  /** Arredonda para cima até o próximo múltiplo de `stepCents`. */
  roundUpToMultiple(stepCents: number): Money {
    if (!Number.isInteger(stepCents) || stepCents <= 0) {
      throw new DomainError("Múltiplo de arredondamento inválido.");
    }
    return Money.fromCents(Math.ceil(this.cents / stepCents) * stepCents);
  }

  isZero(): boolean {
    return this.cents === 0;
  }

  isNegative(): boolean {
    return this.cents < 0;
  }

  isGreaterThan(other: Money): boolean {
    return this.cents > other.cents;
  }

  isLessThan(other: Money): boolean {
    return this.cents < other.cents;
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  static sum(values: readonly Money[]): Money {
    return values.reduce((total, value) => total.plus(value), Money.zero);
  }
}
