import { DomainError } from "./domain-error";

/**
 * Quantidade de material, com unidade normalizada.
 *
 * Compra e uso precisam pertencer à mesma família de unidade, conforme a seção
 * 4 do documento 06. A normalização acontece no catálogo; aqui a quantidade já
 * chega na unidade base.
 */
export class Quantity {
  private constructor(
    private readonly amount: number,
    readonly unit: string,
  ) {}

  static of(amount: number, unit: string, field?: string): Quantity {
    if (!Number.isFinite(amount)) {
      throw new DomainError("Quantidade inválida.", field);
    }
    if (amount < 0) {
      throw new DomainError("Quantidade não pode ser negativa.", field);
    }
    return new Quantity(amount, unit);
  }

  /** Quantidade comprada: precisa ser maior que zero para gerar custo unitário. */
  static purchased(amount: number, unit: string, field = "quantidade_comprada"): Quantity {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new DomainError("A quantidade comprada precisa ser maior que zero.", field);
    }
    return new Quantity(amount, unit);
  }

  toNumber(): number {
    return this.amount;
  }

  /** Razão entre duas quantidades da mesma unidade, usada no custo consumido. */
  ratioTo(other: Quantity): number {
    if (this.unit !== other.unit) {
      throw new DomainError(
        `Não é possível comparar ${this.unit} com ${other.unit}. Converta para a mesma unidade.`,
      );
    }
    if (other.amount === 0) {
      throw new DomainError("A quantidade comprada precisa ser maior que zero.");
    }
    return this.amount / other.amount;
  }

  isZero(): boolean {
    return this.amount === 0;
  }
}
