import { describe, expect, it } from 'vitest';
import { SLIDES_DA_APRESENTACAO, indiceDaRolagem, telaDeAbertura } from './apresentacao';

/**
 * A apresentação tem duas regras que não podem regredir em silêncio: ela
 * aparece uma vez só por aparelho, e o ponto ativo tem de dizer a verdade sobre
 * onde a rolagem parou.
 */

describe('qual tela abre o aplicativo', () => {
  it('mostra a apresentação na primeira abertura', () => {
    expect(telaDeAbertura({ apresentacaoVista: false, autenticada: false })).toBe('apresentacao');
  });

  it('não mostra de novo depois de vista', () => {
    expect(telaDeAbertura({ apresentacaoVista: true, autenticada: false })).toBe('entrada');
  });

  it('não decide nada enquanto a leitura do aparelho não voltou', () => {
    expect(telaDeAbertura({ apresentacaoVista: null, autenticada: false })).toBe('aguardando');
  });

  it('não repete para quem já tem conta neste aparelho, nem sem a marca', () => {
    // É o caso de quem já usava o aplicativo antes desta tela existir: sair da
    // conta não pode devolvê-la à apresentação.
    expect(telaDeAbertura({ apresentacaoVista: false, autenticada: true })).toBe('entrada');
    expect(telaDeAbertura({ apresentacaoVista: null, autenticada: true })).toBe('entrada');
  });
});

describe('página em que a rolagem parou', () => {
  const total = SLIDES_DA_APRESENTACAO.length;

  it('conta a página pela largura da tela', () => {
    expect(indiceDaRolagem(0, 360, total)).toBe(0);
    expect(indiceDaRolagem(360, 360, total)).toBe(1);
    // Rolagem parada no meio do caminho arredonda para a página mais próxima.
    expect(indiceDaRolagem(700, 360, total)).toBe(2);
  });

  it('devolve zero antes de a tela ser medida, em vez de NaN', () => {
    expect(indiceDaRolagem(120, 0, total)).toBe(0);
  });

  it('não passa da última página nem volta antes da primeira', () => {
    expect(indiceDaRolagem(99_999, 360, total)).toBe(total - 1);
    // A borracha do iOS entrega deslocamento negativo ao puxar para trás.
    expect(indiceDaRolagem(-80, 360, total)).toBe(0);
  });
});

describe('conteúdo das telas', () => {
  it('tem três telas, cada uma com título e texto', () => {
    expect(SLIDES_DA_APRESENTACAO).toHaveLength(3);
    for (const slide of SLIDES_DA_APRESENTACAO) {
      expect(slide.titulo.length).toBeGreaterThan(0);
      expect(slide.texto.length).toBeGreaterThan(0);
    }
  });

  it('não vende recurso que ainda não existe', () => {
    // A "Regra de comunicação dos planos" (seção 6 do documento 01) proíbe
    // apresentar como disponível o que ainda é demonstração — clientes e
    // financeiro são telas sem servidor.
    const texto = SLIDES_DA_APRESENTACAO.map((slide) => `${slide.titulo} ${slide.texto}`).join(' ').toLowerCase();
    for (const promessa of ['cadastro de clientes', 'financeiro', 'fluxo de caixa', 'relatórios avançados', 'controle de estoque']) {
      expect(texto).not.toContain(promessa);
    }
  });

  it('não promete lucro garantido', () => {
    const texto = SLIDES_DA_APRESENTACAO.map((slide) => slide.texto).join(' ').toLowerCase();
    for (const promessa of ['lucre', 'garantido', 'dobre', 'triplique']) {
      expect(texto).not.toContain(promessa);
    }
  });
});
