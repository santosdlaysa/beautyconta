import type { Equipment } from './resources';

/**
 * Reserva para reposição de equipamentos, do documento 07.
 *
 * O servidor soma a reserva dentro do custo fixo e devolve só o total do
 * negócio (`equipmentReserveCents`); a parcela de **cada** equipamento não vem
 * na resposta porque é derivada — nasce dos mesmos três números que já estão na
 * lista. Recalculá-la aqui é o que permite a tela responder "de onde saem estes
 * R$ 33,33" sem uma requisição por linha.
 *
 * Por ser cópia de uma regra que mora no servidor, a fórmula é testada em
 * `equipment.test.ts`: se as duas divergirem, a lista passa a explicar um
 * número que o preço não usou.
 */

/** Limites da seção 8 do documento 07. */
export const MIN_USEFUL_LIFE_MONTHS = 1;
export const MAX_USEFUL_LIFE_MONTHS = 240;

/**
 * Abaixo disto a seção 11 manda avisar: vida útil curta demais infla a reserva,
 * e a reserva agora entra no preço de todos os serviços. É aviso, não recusa —
 * pode ser real para o que se gasta rápido.
 */
export const SHORT_LIFE_MONTHS = 12;

/** O que a reserva precisa saber de um equipamento — nada além disto. */
export type ReserveInput = Pick<
  Equipment,
  'acquisitionPriceCents' | 'residualValueCents' | 'usefulLifeMonths' | 'acquisitionDate' | 'isArchived'
>;

/**
 * Quantos meses inteiros se passaram desde a compra.
 *
 * Conta mês de calendário, e não trinta dias: quem comprou em 15 de janeiro
 * completou um mês em 15 de fevereiro, e é assim que a pessoa pensa.
 *
 * A data chega como `AAAA-MM-DD` e é lida pedaço a pedaço, sem virar `Date`:
 * `new Date('2026-01-15')` é meia-noite em UTC e, a oeste de Greenwich, volta
 * um dia — o que faria a reserva vencer um mês antes da hora.
 */
export function monthsSince(acquisitionDate: string, now: Date = new Date()): number {
  const match = acquisitionDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return 0;

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const anos = now.getFullYear() - year;
  const meses = now.getMonth() + 1 - month;
  const passou = now.getDate() >= day ? 0 : -1;

  return Math.max(0, anos * 12 + meses + passou);
}

/** A vida útil informada já terminou: a reserva daquele item está completa. */
export function isReserveComplete(item: ReserveInput, now: Date = new Date()): boolean {
  return monthsSince(item.acquisitionDate, now) >= item.usefulLifeMonths;
}

/**
 * Reserva mensal de um equipamento, em centavos.
 *
 * Zero para o arquivado e para o que já venceu: o documento 07 é explícito em
 * que o vencido continua na lista, com aviso de que a reserva terminou, e
 * **deixa de somar**. Continuar cobrando por ele encareceria o serviço para
 * guardar um dinheiro que já foi guardado.
 */
export function monthlyReserveCents(item: ReserveInput, now: Date = new Date()): number {
  if (item.isArchived) return 0;
  if (isReserveComplete(item, now)) return 0;
  if (item.usefulLifeMonths <= 0) return 0;

  const desgaste = item.acquisitionPriceCents - item.residualValueCents;
  if (desgaste <= 0) return 0;

  return Math.round(desgaste / item.usefulLifeMonths);
}

/** `RE`: a soma das reservas dos equipamentos que ainda contam. */
export function totalMonthlyReserveCents(items: readonly ReserveInput[], now: Date = new Date()): number {
  return items.reduce((total, item) => total + monthlyReserveCents(item, now), 0);
}
