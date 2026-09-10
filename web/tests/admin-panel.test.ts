import { describe, expect, it } from "vitest";
import {
  MAX_PRICE_CENTS,
  MIN_PRICE_CENTS,
  centsToInput,
  parsePriceToCents,
  subscriptionTone,
  validateOfferPrice,
} from "../src/application/use-cases/admin-panel";

/**
 * O painel edita preço, e preço digitado errado é dinheiro cobrado errado.
 *
 * Estes testes cobrem a conversão do que a pessoa escreve para os centavos que
 * o servidor recebe — o ponto exato onde mil e duzentos reais viram um real e
 * vinte se a leitura do separador estiver trocada.
 */

describe("preço digitado", () => {
  it.each([
    ["29,90", 2_990],
    ["29.90", 2_990],
    ["R$ 29,90", 2_990],
    ["29", 2_900],
    ["1.234,56", 123_456],
    ["0,99", 99],
  ])("lê %s como %i centavos", (texto, esperado) => {
    expect(parsePriceToCents(texto)).toBe(esperado);
  });

  it("trata a vírgula como decimal e o ponto como milhar", () => {
    // Trocar os dois transformaria mil e duzentos reais em um real e vinte.
    expect(parsePriceToCents("1.200,00")).toBe(120_000);
    expect(parsePriceToCents("1200,00")).toBe(120_000);
  });

  it("devolve nulo, e nunca zero, quando não dá para ler", () => {
    // Zero é um preço válido de digitar e inválido de cobrar: confundir os dois
    // publicaria uma assinatura de graça.
    for (const texto of ["", "   ", "abc", "R$"]) {
      expect(parsePriceToCents(texto)).toBeNull();
    }
  });

  it("recusa valor negativo", () => {
    expect(parsePriceToCents("-10,00")).toBeNull();
  });

  it("volta ao texto sem perder centavos", () => {
    expect(centsToInput(2_990)).toBe("29,90");
    expect(centsToInput(29_900)).toBe("299,00");
    expect(centsToInput(99)).toBe("0,99");
  });

  it("ida e volta preserva o valor", () => {
    for (const centavos of [100, 2_990, 29_900, 123_456]) {
      expect(parsePriceToCents(centsToInput(centavos))).toBe(centavos);
    }
  });
});

describe("faixa aceita", () => {
  it("avisa antes de enviar, em vez de deixar o servidor recusar", () => {
    expect(validateOfferPrice(null)).toMatch(/digite/i);
    expect(validateOfferPrice(MIN_PRICE_CENTS - 1)).toMatch(/menor preço/i);
    expect(validateOfferPrice(MAX_PRICE_CENTS + 1)).toMatch(/maior preço/i);
  });

  it("aceita o que está dentro da faixa", () => {
    expect(validateOfferPrice(MIN_PRICE_CENTS)).toBeNull();
    expect(validateOfferPrice(2_990)).toBeNull();
    expect(validateOfferPrice(MAX_PRICE_CENTS)).toBeNull();
  });
});

describe("situação da assinatura", () => {
  const agora = new Date("2026-09-10T12:00:00.000Z");
  const futuro = "2026-10-10T12:00:00.000Z";
  const passado = "2026-08-10T12:00:00.000Z";

  it("ativa e renovando aparece como tudo certo", () => {
    expect(
      subscriptionTone(
        { status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: futuro },
        agora,
      ),
    ).toBe("ok");
  });

  it("cancelada com período em aberto ainda dá acesso", () => {
    // Mostrar isso como encerrado assustaria à toa: a assinante segue com o
    // plano até a data, e foi o que ela pagou.
    expect(
      subscriptionTone(
        { status: "active", cancelAtPeriodEnd: true, currentPeriodEnd: futuro },
        agora,
      ),
    ).toBe("warn");
  });

  it("carência aparece como atenção, não como perda", () => {
    expect(
      subscriptionTone(
        { status: "in_grace", cancelAtPeriodEnd: false, currentPeriodEnd: futuro },
        agora,
      ),
    ).toBe("warn");
  });

  it("período vencido ou situação encerrada aparece como desligada", () => {
    expect(
      subscriptionTone(
        { status: "active", cancelAtPeriodEnd: true, currentPeriodEnd: passado },
        agora,
      ),
    ).toBe("off");
    expect(
      subscriptionTone({ status: "expired", cancelAtPeriodEnd: true, currentPeriodEnd: passado }, agora),
    ).toBe("off");
  });
});
