import { afterEach, describe, expect, it } from 'vitest';
import {
  EVENT_NAMES,
  nullDestination,
  sanitizeProperties,
  setAnalyticsDestination,
  track,
  type AnalyticsEvent,
} from './analytics';

/**
 * Critério de aceite do item C-05: existe teste que falha se uma propriedade
 * proibida for enviada.
 *
 * O teste não confere a intenção de quem chamou `track` — confere o que chega
 * ao destino. Se alguém acrescentar uma propriedade com preço, nome, e-mail ou
 * telefone em qualquer tela, a proteção da camada precisa remover a
 * propriedade, e é isso que estas asserções verificam.
 */

const captured: AnalyticsEvent[] = [];

function capture(): void {
  captured.length = 0;
  setAnalyticsDestination((event) => captured.push(event));
}

afterEach(() => {
  setAnalyticsDestination(nullDestination);
});

describe('propriedades proibidas', () => {
  const proibidas: Record<string, unknown> = {
    priceCents: 12990,
    precoFinal: '129,90',
    valorTotal: 129.9,
    custoTotal: 45,
    lucroEsperado: 84,
    margemPercent: 65,
    faturamentoMensal: 3000,
    metaDeLucro: 2000,
    retiradaDesejada: 3000,
    name: 'Ana Beatriz',
    userName: 'Ana',
    nomeDoServico: 'Alongamento em gel',
    email: 'ana@exemplo.com.br',
    telefone: '95999990000',
    whatsapp: '+5595999990000',
    cpf: '000.000.000-00',
  };

  it('não deixa nenhuma delas chegar ao destino', () => {
    capture();

    track('calculation_completed', { ...proibidas, origem: 'servico' });

    expect(captured).toHaveLength(1);
    for (const chave of Object.keys(proibidas)) {
      expect(captured[0].properties).not.toHaveProperty(chave);
    }
    // O que sobra é só o rótulo inofensivo.
    expect(captured[0].properties).toEqual({ origem: 'servico' });
  });

  it('relata cada propriedade descartada', () => {
    const { safe, removed } = sanitizeProperties(proibidas);

    expect(safe).toEqual({});
    expect(removed.sort()).toEqual(Object.keys(proibidas).sort());
  });

  it('recusa dinheiro mesmo quando a chave não denuncia', () => {
    // Segunda barreira: quantia grande ou quebrada não é contagem de nada.
    const { safe } = sanitizeProperties({ v: 12990, x: 129.9, y: -1 });
    expect(safe).toEqual({});
  });

  it('recusa texto livre, que é onde nome e e-mail se escondem', () => {
    const { safe } = sanitizeProperties({
      rotulo: 'Ana Beatriz Souza',
      contato: 'ana@exemplo.com.br',
      observacao: 'cliente pediu desconto de 20 reais',
    });
    expect(safe).toEqual({});
  });
});

describe('o que a camada aceita', () => {
  it('deixa passar rótulo curto, contagem pequena e booleano', () => {
    capture();

    track('plan_limit_reached', { resource: 'services', usados: 3, primeiraVez: true });

    expect(captured[0].properties).toEqual({ resource: 'services', usados: 3, primeiraVez: true });
  });

  it('emite os doze eventos do funil', () => {
    capture();

    for (const name of EVENT_NAMES) track(name);

    expect(captured.map((event) => event.name)).toEqual([...EVENT_NAMES]);
    expect(EVENT_NAMES).toHaveLength(12);
  });

  it('carimba a hora sem identificar ninguém', () => {
    capture();

    track('calculator_viewed');

    expect(Object.keys(captured[0])).toEqual(['name', 'properties', 'at']);
    expect(Number.isNaN(Date.parse(captured[0].at))).toBe(false);
  });
});

describe('destino trocável', () => {
  it('para de entregar quando o destino é o nulo', () => {
    capture();
    setAnalyticsDestination(nullDestination);

    track('signup_started');

    expect(captured).toHaveLength(0);
  });

  it('não deixa uma falha do destino subir para a tela', () => {
    setAnalyticsDestination(() => {
      throw new Error('destino fora do ar');
    });

    expect(() => track('signup_completed')).not.toThrow();
  });
});
