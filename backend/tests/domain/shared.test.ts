import { describe, expect, it } from "vitest";
import { DomainError, Duration, Money, Percentage, Quantity } from "../../src/domain/shared";

describe("Money", () => {
  it("guarda centavos inteiros e não perde precisão em soma repetida", () => {
    const dez = Money.fromReais(0.1);
    const soma = Money.sum(Array.from({ length: 10 }, () => dez));

    expect(soma.toCents()).toBe(100);
    expect(soma.toReais()).toBe(1);
  });

  it("arredonda reais para o centavo mais próximo na entrada", () => {
    expect(Money.fromReais(5.625).toCents()).toBe(563);
    expect(Money.fromReais(5.624).toCents()).toBe(562);
  });

  it("recusa centavos fracionários", () => {
    expect(() => Money.fromCents(10.5)).toThrow(DomainError);
  });

  it("recusa valor acima do limite operacional", () => {
    expect(() => Money.fromReais(100_000_001)).toThrow(DomainError);
  });

  it("recusa divisão por zero", () => {
    expect(() => Money.fromReais(10).dividedBy(0)).toThrow(DomainError);
  });

  it("arredonda para cima até o múltiplo pedido", () => {
    const preco = Money.fromReais(171.43);

    expect(preco.roundUpToMultiple(100).toReais()).toBe(172);
    expect(preco.roundUpToMultiple(500).toReais()).toBe(175);
    expect(preco.roundUpToMultiple(1000).toReais()).toBe(180);
  });

  it("mantém o valor quando já é múltiplo exato", () => {
    expect(Money.fromReais(175).roundUpToMultiple(500).toReais()).toBe(175);
  });

  it("compara e subtrai preservando sinal", () => {
    const custo = Money.fromReais(120);
    const preco = Money.fromReais(100);

    expect(preco.minus(custo).isNegative()).toBe(true);
    expect(custo.isGreaterThan(preco)).toBe(true);
  });
});

describe("Percentage", () => {
  it("converte pontos percentuais em fração", () => {
    expect(Percentage.fromPercent(30).toFraction()).toBe(0.3);
    expect(Percentage.fromPercent(30).toPercent()).toBe(30);
  });

  it("respeita o teto do campo e aponta qual é", () => {
    const erro = (() => {
      try {
        Percentage.fromPercent(96, { field: "margem", max: 95 });
      } catch (e) {
        return e as DomainError;
      }
    })();

    expect(erro).toBeInstanceOf(DomainError);
    expect(erro?.field).toBe("margem");
  });

  it("recusa percentual negativo", () => {
    expect(() => Percentage.fromPercent(-1)).toThrow(DomainError);
  });
});

describe("Duration", () => {
  it("converte horas e minutos", () => {
    const duracao = Duration.fromHoursAndMinutes(2, 30);

    expect(duracao.toMinutes()).toBe(150);
    expect(duracao.toHours()).toBe(2.5);
  });

  it("recusa duração fora da faixa da seção 11 do documento 03", () => {
    expect(() => Duration.fromMinutes(0)).toThrow(DomainError);
    expect(() => Duration.fromMinutes(1441)).toThrow(DomainError);
  });
});

describe("Quantity", () => {
  it("calcula a razão entre uso e compra na mesma unidade", () => {
    const usado = Quantity.of(1.5, "g");
    const comprado = Quantity.purchased(24, "g");

    expect(usado.ratioTo(comprado)).toBeCloseTo(0.0625, 10);
  });

  it("recusa comparação entre unidades diferentes", () => {
    expect(() => Quantity.of(1, "g").ratioTo(Quantity.purchased(1, "ml"))).toThrow(DomainError);
  });

  it("exige quantidade comprada maior que zero", () => {
    expect(() => Quantity.purchased(0, "g")).toThrow(DomainError);
  });
});
