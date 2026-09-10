import { DomainError } from "../shared/domain-error";

/**
 * Reserva mensal para reposição de equipamentos, do documento 07.
 *
 * O termo contábil é depreciação, e o documento é explícito em não usá-lo
 * sozinho na interface: a ideia é guardar um pouco por mês para trocar a cabine
 * quando ela morrer, não fazer contabilidade fiscal.
 *
 * A reserva **não cria termo novo** nas fórmulas do documento 03. Ela entra no
 * custo fixo mensal, e o rateio segue igual — por hora produtiva ou por
 * atendimento.
 */

export type EquipmentForReserve = {
  acquisitionPriceCents: number;
  residualValueCents: number;
  usefulLifeMonths: number;
  acquisitionDate: Date;
  isArchived: boolean;
};

/** Limites da seção 8 do documento 07. */
export const MIN_USEFUL_LIFE_MONTHS = 1;
export const MAX_USEFUL_LIFE_MONTHS = 240;

/**
 * Vida útil abaixo disso costuma ser engano, e engano aqui infla o preço.
 * O documento 07 pede aviso, não recusa: pode ser real para material que se
 * gasta rápido.
 */
export const SHORT_LIFE_MONTHS = 6;

export function assertValidEquipment(input: {
  acquisitionPriceCents: number;
  residualValueCents: number;
  usefulLifeMonths: number;
  acquisitionDate: Date;
  now?: Date;
}): void {
  const { acquisitionPriceCents, residualValueCents, usefulLifeMonths } = input;

  if (acquisitionPriceCents <= 0) {
    throw new DomainError("O valor de compra precisa ser maior que zero.", "acquisitionPriceCents");
  }
  if (residualValueCents < 0) {
    throw new DomainError("O valor de revenda não pode ser negativo.", "residualValueCents");
  }
  if (residualValueCents >= acquisitionPriceCents) {
    throw new DomainError(
      "O valor de revenda precisa ser menor que o de compra — senão não há desgaste a guardar.",
      "residualValueCents",
    );
  }
  if (
    !Number.isInteger(usefulLifeMonths) ||
    usefulLifeMonths < MIN_USEFUL_LIFE_MONTHS ||
    usefulLifeMonths > MAX_USEFUL_LIFE_MONTHS
  ) {
    throw new DomainError(
      `A vida útil precisa ser de ${MIN_USEFUL_LIFE_MONTHS} a ${MAX_USEFUL_LIFE_MONTHS} meses.`,
      "usefulLifeMonths",
    );
  }

  const agora = input.now ?? new Date();
  if (input.acquisitionDate.getTime() > agora.getTime()) {
    throw new DomainError("A data da compra não pode estar no futuro.", "acquisitionDate");
  }
}

/**
 * Quantos meses já se passaram desde a compra.
 *
 * Conta mês de calendário, e não trinta dias: quem comprou em 15 de janeiro
 * completou um mês em 15 de fevereiro, e é assim que a pessoa pensa.
 */
export function monthsSince(acquisitionDate: Date, now: Date): number {
  const anos = now.getUTCFullYear() - acquisitionDate.getUTCFullYear();
  const meses = now.getUTCMonth() - acquisitionDate.getUTCMonth();
  const passou = now.getUTCDate() >= acquisitionDate.getUTCDate() ? 0 : -1;

  return Math.max(0, anos * 12 + meses + passou);
}

/**
 * Reserva mensal de um equipamento, em centavos.
 *
 * Zero quando o equipamento está arquivado ou quando a vida útil já venceu — o
 * documento 07 é explícito: equipamento vencido continua na lista, com aviso de
 * que a reserva terminou, e **deixa de somar**. Continuar cobrando por ele
 * inflaria o preço para guardar dinheiro que já foi guardado.
 */
export function monthlyReserveCents(equipment: EquipmentForReserve, now: Date): number {
  if (equipment.isArchived) return 0;
  if (monthsSince(equipment.acquisitionDate, now) >= equipment.usefulLifeMonths) return 0;

  const desgaste = equipment.acquisitionPriceCents - equipment.residualValueCents;
  if (desgaste <= 0) return 0;

  return Math.round(desgaste / equipment.usefulLifeMonths);
}

/** `RE`: a soma das reservas dos equipamentos que ainda contam. */
export function totalMonthlyReserveCents(
  equipment: readonly EquipmentForReserve[],
  now: Date,
): number {
  return equipment.reduce((total, item) => total + monthlyReserveCents(item, now), 0);
}

/** Se a reserva deste equipamento já terminou, para a lista avisar. */
export function isReserveComplete(equipment: EquipmentForReserve, now: Date): boolean {
  return monthsSince(equipment.acquisitionDate, now) >= equipment.usefulLifeMonths;
}
