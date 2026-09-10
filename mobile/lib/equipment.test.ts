import { describe, expect, it } from 'vitest';
import {
  isReserveComplete,
  monthlyReserveCents,
  monthsSince,
  totalMonthlyReserveCents,
  type ReserveInput,
} from './equipment';

/**
 * A reserva mensal é a única conta que a tela refaz por fora do servidor.
 *
 * Ela precisa dar exatamente o mesmo número que o motor usou no preço: se a
 * lista disser R$ 33,33 e o custo fixo tiver somado outra coisa, a profissional
 * vê o preço subir e a explicação não fecha — que é justamente o risco da seção
 * 11 do documento 07. Por isso os casos abaixo são os do documento: a cabine de
 * R$ 1.200 em 36 meses, o equipamento vencido e o arquivado.
 */

const equipamento = (values: Partial<ReserveInput> = {}): ReserveInput => ({
  acquisitionPriceCents: 120_000,
  residualValueCents: 0,
  usefulLifeMonths: 36,
  acquisitionDate: '2026-01-15',
  isArchived: false,
  ...values,
});

const em = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};

describe('meses desde a compra', () => {
  it('conta mês de calendário, e não trinta dias', () => {
    expect(monthsSince('2026-01-15', em('2026-02-14'))).toBe(0);
    expect(monthsSince('2026-01-15', em('2026-02-15'))).toBe(1);
    expect(monthsSince('2026-01-15', em('2027-01-15'))).toBe(12);
  });

  it('não volta no tempo quando a data está no futuro', () => {
    expect(monthsSince('2027-01-15', em('2026-09-10'))).toBe(0);
  });

  it('trata data ilegível como compra de hoje, em vez de quebrar a lista', () => {
    expect(monthsSince('', em('2026-09-10'))).toBe(0);
  });
});

describe('reserva mensal', () => {
  it('divide o desgaste pela vida útil, como o exemplo do documento', () => {
    // Cabine de R$ 1.200 em 36 meses: R$ 33,33 por mês.
    expect(monthlyReserveCents(equipamento(), em('2026-09-10'))).toBe(3333);
  });

  it('desconta o que a pessoa espera receber na revenda', () => {
    expect(
      monthlyReserveCents(equipamento({ residualValueCents: 30_000 }), em('2026-09-10')),
    ).toBe(2500);
  });

  it('para de somar quando a vida útil vence', () => {
    const vencido = equipamento({ acquisitionDate: '2022-01-15' });
    expect(isReserveComplete(vencido, em('2026-09-10'))).toBe(true);
    expect(monthlyReserveCents(vencido, em('2026-09-10'))).toBe(0);
  });

  it('não soma equipamento arquivado', () => {
    expect(monthlyReserveCents(equipamento({ isArchived: true }), em('2026-09-10'))).toBe(0);
  });

  it('não inventa reserva quando a revenda cobre a compra', () => {
    expect(
      monthlyReserveCents(equipamento({ residualValueCents: 120_000 }), em('2026-09-10')),
    ).toBe(0);
  });
});

describe('total do negócio', () => {
  it('soma só o que ainda conta', () => {
    const itens = [
      equipamento(),
      equipamento({ acquisitionPriceCents: 60_000, usefulLifeMonths: 24 }),
      equipamento({ acquisitionDate: '2020-01-15' }),
      equipamento({ isArchived: true }),
    ];

    expect(totalMonthlyReserveCents(itens, em('2026-09-10'))).toBe(3333 + 2500);
  });

  it('é zero sem equipamento nenhum', () => {
    expect(totalMonthlyReserveCents([], em('2026-09-10'))).toBe(0);
  });
});
