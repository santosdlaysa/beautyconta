import { describe, expect, it } from 'vitest';
import {
  bookingUrl,
  formatMinutes,
  formatPhone,
  parseMinutes,
  rangesFromApi,
  rangesOfDay,
  suggestRange,
  telUrl,
  validateWeek,
  whatsappUrl,
  type WorkRange,
} from './booking';

/**
 * A agenda pública mora em duas conversões que a interface não pode errar: o
 * relógio que a usuária digita vira minuto antes de subir, e o telefone que a
 * cliente escreveu vira link antes de virar contato. As duas erram calado — um
 * `NaN` no expediente some a semana inteira, um telefone sem país abre uma
 * conversa com ninguém —, e é por isso que elas são testadas aqui.
 */

describe('relógio e minuto', () => {
  it('lê o formato que a usuária digita', () => {
    expect(parseMinutes('09:00')).toBe(540);
    expect(parseMinutes('9:00')).toBe(540);
    expect(parseMinutes('0900')).toBe(540);
    expect(parseMinutes(' 18:30 ')).toBe(1110);
  });

  it('aceita a meia-noite do fim do dia e recusa o que passa dela', () => {
    expect(parseMinutes('24:00')).toBe(1440);
    expect(parseMinutes('24:30')).toBeNull();
    expect(parseMinutes('25:00')).toBeNull();
  });

  it('recusa o que não é horário', () => {
    expect(parseMinutes('')).toBeNull();
    expect(parseMinutes('manhã')).toBeNull();
    expect(parseMinutes('09:70')).toBeNull();
  });

  it('volta ao relógio sem perder o zero da esquerda', () => {
    expect(formatMinutes(540)).toBe('09:00');
    expect(formatMinutes(0)).toBe('00:00');
    expect(formatMinutes(1110)).toBe('18:30');
  });
});

describe('expediente vindo da API', () => {
  it('converte o relógio da leitura para o minuto da escrita', () => {
    const ranges = rangesFromApi([{ weekday: 4, start: '09:00', end: '12:00' }]);
    expect(ranges).toEqual([{ weekday: 4, startMinute: 540, endMinute: 720 }]);
  });

  it('descarta faixa impossível em vez de deixar NaN na tela', () => {
    expect(rangesFromApi([{ weekday: 1, start: 'xx:xx', end: '12:00' }])).toEqual([]);
  });

  it('ordena por dia e, dentro do dia, por horário', () => {
    const ranges = rangesFromApi([
      { weekday: 2, start: '13:00', end: '18:00' },
      { weekday: 1, start: '09:00', end: '12:00' },
      { weekday: 2, start: '09:00', end: '12:00' },
    ]);
    expect(ranges.map((range) => [range.weekday, range.startMinute])).toEqual([
      [1, 540],
      [2, 540],
      [2, 780],
    ]);
  });

  it('separa as faixas de um dia só', () => {
    const week: WorkRange[] = [
      { weekday: 3, startMinute: 540, endMinute: 720 },
      { weekday: 4, startMinute: 540, endMinute: 720 },
    ];
    expect(rangesOfDay(week, 3)).toHaveLength(1);
  });
});

describe('semana antes de subir', () => {
  it('aceita manhã e tarde no mesmo dia, com almoço no meio', () => {
    const week: WorkRange[] = [
      { weekday: 2, startMinute: 540, endMinute: 720 },
      { weekday: 2, startMinute: 780, endMinute: 1080 },
    ];
    expect(validateWeek(week)).toBeNull();
  });

  it('recusa duas faixas do mesmo dia que se sobrepõem', () => {
    const week: WorkRange[] = [
      { weekday: 2, startMinute: 540, endMinute: 780 },
      { weekday: 2, startMinute: 720, endMinute: 1080 },
    ];
    expect(validateWeek(week)).toContain('sobrepõem');
  });

  it('deixa passar o mesmo horário em dias diferentes', () => {
    const week: WorkRange[] = [
      { weekday: 2, startMinute: 540, endMinute: 720 },
      { weekday: 3, startMinute: 540, endMinute: 720 },
    ];
    expect(validateWeek(week)).toBeNull();
  });

  it('recusa fim antes do início', () => {
    expect(validateWeek([{ weekday: 5, startMinute: 720, endMinute: 540 }])).toContain('Sexta-feira');
  });

  it('sugere manhã na primeira faixa e tarde na segunda', () => {
    expect(suggestRange([])).toEqual({ startMinute: 540, endMinute: 720 });
    expect(suggestRange([{ weekday: 1, startMinute: 540, endMinute: 720 }])).toEqual({
      startMinute: 780,
      endMinute: 1080,
    });
  });
});

describe('contato da cliente', () => {
  it('acrescenta o país no número brasileiro digitado sem ele', () => {
    expect(whatsappUrl('(95) 99999-1234')).toBe('https://wa.me/5595999991234');
    expect(whatsappUrl('95 9999-1234')).toBe('https://wa.me/559599991234');
  });

  it('repassa o número que já veio com país', () => {
    expect(whatsappUrl('+351 912 345 678')).toBe('https://wa.me/351912345678');
  });

  it('não inventa conversa com número incompleto', () => {
    expect(whatsappUrl('9999-1234')).toBeNull();
    expect(telUrl('123')).toBeNull();
  });

  it('liga com os dígitos, sem os símbolos de leitura', () => {
    expect(telUrl('(95) 99999-1234')).toBe('tel:95999991234');
  });

  it('escreve o telefone como se lê no Brasil', () => {
    expect(formatPhone('95999991234')).toBe('(95) 99999-1234');
    expect(formatPhone('9599991234')).toBe('(95) 9999-1234');
    expect(formatPhone('+351 912 345 678')).toBe('+351 912 345 678');
  });
});

describe('endereço do link', () => {
  it('aponta para a página de agendamento do site', () => {
    expect(bookingUrl('abc123')).toMatch(/\/agendar\/abc123$/);
  });

  it('não duplica a barra quando a base termina em uma', () => {
    expect(bookingUrl('abc123')).not.toContain('//agendar');
  });
});
