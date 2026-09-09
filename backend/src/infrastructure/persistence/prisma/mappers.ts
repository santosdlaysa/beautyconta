import { Prisma } from "@prisma/client";

/**
 * Conversões de borda entre o banco e os registros da aplicação.
 *
 * O ADR-0002 é explícito: `BigInt` e `Decimal` do Prisma não são serializáveis
 * em JSON e não podem vazar para dentro. A tradução acontece aqui, e em nenhum
 * outro lugar.
 */

/** Maior valor monetário aceito, em centavos, igual ao teto de `Money`. */
const MAX_CENTS = 10_000_000_000n;

export function centsToNumber(value: bigint): number {
  if (value > MAX_CENTS || value < -MAX_CENTS) {
    // Um valor além disso só entra no banco por escrita fora da aplicação.
    throw new Error(`Valor monetário fora da faixa aceita: ${value}`);
  }
  return Number(value);
}

export function numberToCents(value: number): bigint {
  if (!Number.isFinite(value)) {
    throw new Error("Valor monetário inválido.");
  }
  return BigInt(Math.round(value));
}

export function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

export function numberToDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
