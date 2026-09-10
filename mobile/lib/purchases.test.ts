import { describe, expect, it } from 'vitest';
import { allowedPaymentMethods, interpretarErro, periodFromProductId } from './purchases.web';

/**
 * A parte da compra que dá para verificar sem loja e sem aparelho.
 *
 * O teste importa a versão web de propósito: ela tem as mesmas funções puras e
 * não carrega módulo nativo, que não existe aqui.
 */

describe('onde cada forma de pagamento é permitida', () => {
  it('dentro do aplicativo de loja, quem vende é a loja', () => {
    // Oferecer Pix ou checkout do Mercado Pago aqui é motivo de recusa na
    // submissão: Apple e Google exigem o sistema de pagamento delas para
    // conteúdo digital.
    expect(allowedPaymentMethods('ios')).toBe('store');
    expect(allowedPaymentMethods('android')).toBe('store');
  });

  it('na web valem cartão e Pix, sem comissão de loja', () => {
    expect(allowedPaymentMethods('web')).toStrictEqual(['card', 'pix']);
  });
});

describe('período do produto', () => {
  it.each([
    ['beautyconta_premium_monthly', 'MONTHLY'],
    ['beautyconta_premium_annual', 'ANNUAL'],
    ['premium_yearly', 'ANNUAL'],
    ['plano_mensal', 'MONTHLY'],
    ['premium_anual', 'ANNUAL'],
  ])('lê %s como %s', (produto, esperado) => {
    expect(periodFromProductId(produto)).toBe(esperado);
  });

  it('não adivinha quando o identificador não diz', () => {
    // Chutar mensal num produto anual mostraria o período errado na tela.
    expect(periodFromProductId('beautyconta_premium')).toBe('UNKNOWN');
  });
});

describe('erro da compra', () => {
  it('desistência não é falha', () => {
    // Tratar como erro encheria a tela de vermelho para quem só mudou de ideia.
    expect(interpretarErro({ userCancelled: true })).toStrictEqual({ status: 'cancelled' });
  });

  it('falha de verdade leva a mensagem do provedor', () => {
    expect(interpretarErro({ message: 'Cartão recusado' })).toStrictEqual({
      status: 'error',
      message: 'Cartão recusado',
    });
  });

  it('erro sem mensagem ainda diz algo à assinante', () => {
    const resultado = interpretarErro(null);

    expect(resultado.status).toBe('error');
    expect(resultado).toHaveProperty('message', expect.stringContaining('Não foi possível'));
  });
});
