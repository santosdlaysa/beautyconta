import { describe, expect, it } from 'vitest';
import {
  guiaCumprido,
  passosConcluidos,
  passosEssenciais,
  primeirosPassos,
  type EstadoDoNegocio,
} from './primeirosPassos';

/**
 * A lista de primeiros passos lê o estado real da conta, e é isso que a
 * diferencia de um carrossel: um passo já cumprido no onboarding nasce marcado,
 * e a lista some sozinha quando o essencial estiver pronto.
 */

const negocio = (values: Partial<EstadoDoNegocio> = {}): EstadoDoNegocio => ({
  calculos: 0,
  materiais: 0,
  custosFixos: 0,
  temLinkDeAgenda: false,
  ...values,
});

const passo = (estado: EstadoDoNegocio, id: string) => {
  const encontrado = primeirosPassos(estado).find((item) => item.id === id);
  if (!encontrado) throw new Error(`Passo ${id} saiu da lista.`);
  return encontrado;
};

describe('quais passos já estão prontos', () => {
  it('começa com tudo em aberto na conta recém-configurada', () => {
    expect(passosConcluidos(primeirosPassos(negocio()))).toBe(0);
  });

  it('marca o primeiro preço quando já existe cálculo no histórico', () => {
    // Quem não pulou a etapa 5 do onboarding chega à Home com este passo feito.
    expect(passo(negocio({ calculos: 1 }), 'primeiro-preco').concluido).toBe(true);
    expect(passo(negocio(), 'primeiro-preco').concluido).toBe(false);
  });

  it('marca material e custo fixo pelo que está cadastrado', () => {
    expect(passo(negocio({ materiais: 2 }), 'material').concluido).toBe(true);
    expect(passo(negocio({ custosFixos: 1 }), 'custo-fixo').concluido).toBe(true);
  });

  it('marca a agenda online quando o link já existe', () => {
    expect(passo(negocio({ temLinkDeAgenda: true }), 'agenda-online').concluido).toBe(true);
  });
});

describe('quando a lista sai da tela', () => {
  const essencial = negocio({ calculos: 1, materiais: 1, custosFixos: 1 });

  it('some com os três essenciais prontos, mesmo sem link de agenda', () => {
    // Quem atende em salão pode nunca querer link público; a lista não pode
    // ficar presa por causa disso. O caminho continua na Home.
    expect(guiaCumprido(essencial)).toBe(true);
  });

  it('continua na tela enquanto faltar qualquer essencial', () => {
    expect(guiaCumprido(negocio({ calculos: 1, materiais: 1 }))).toBe(false);
    expect(guiaCumprido(negocio({ calculos: 1, custosFixos: 1 }))).toBe(false);
    expect(guiaCumprido(negocio({ materiais: 1, custosFixos: 1 }))).toBe(false);
  });

  it('o link da agenda sozinho não fecha a lista', () => {
    expect(guiaCumprido(negocio({ temLinkDeAgenda: true }))).toBe(false);
  });
});

describe('a lista em si', () => {
  it('ensina o caminho na ordem: preço, material, custo fixo e agenda', () => {
    expect(primeirosPassos(negocio()).map((item) => item.id)).toEqual([
      'primeiro-preco',
      'material',
      'custo-fixo',
      'agenda-online',
    ]);
  });

  it('conta três essenciais, e só a agenda é opcional', () => {
    const passos = primeirosPassos(negocio());
    expect(passosEssenciais(passos)).toHaveLength(3);
    expect(passos.filter((item) => item.opcional).map((item) => item.id)).toEqual(['agenda-online']);
  });

  it('cita as telas pelos nomes que elas têm hoje', () => {
    const telas = primeirosPassos(negocio()).map((item) => item.tela);
    expect(telas).toEqual(['Calcular preço', 'Estoque', 'Custos', 'Agenda online']);
  });
});
