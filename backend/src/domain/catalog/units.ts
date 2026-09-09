import { DomainError } from "../shared/domain-error";
import { UNITS, type UnitSlug } from "./catalogs";

const BY_SLUG = new Map(UNITS.map((unit) => [unit.slug, unit]));

export function isUnitSlug(value: string): value is UnitSlug {
  return BY_SLUG.has(value as UnitSlug);
}

/**
 * Converte uma quantidade entre unidades da mesma família, conforme a seção 4
 * do documento 06.
 *
 * Unidade sem família — `box` e `custom` — só converte para ela mesma: a
 * quantidade por caixa é informação da usuária e não pode ser adivinhada aqui.
 * A regra do documento é explícita: quando as famílias não batem, o sistema
 * pede a conversão em vez de estimar.
 */
export function convertQuantity(
  amount: number,
  from: UnitSlug,
  to: UnitSlug,
  field?: string,
): number {
  if (from === to) return amount;

  const origin = BY_SLUG.get(from);
  const target = BY_SLUG.get(to);

  if (!origin || !target) {
    throw new DomainError("Unidade de medida desconhecida.", field);
  }
  if (origin.family === null || target.family === null || origin.family !== target.family) {
    throw new DomainError(
      `Não é possível converter ${origin.label} em ${target.label}. Use a mesma unidade da compra.`,
      field,
    );
  }

  // Ambas têm família, então ambas têm fator.
  return (amount * (origin.factor as number)) / (target.factor as number);
}
