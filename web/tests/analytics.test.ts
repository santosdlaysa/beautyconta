import { describe, expect, it } from "vitest";
import { ANALYTICS_EVENTS, type AnalyticsDestination, type AnalyticsEvent } from "../src/application/ports/analytics";
import {
  createAnalyticsEmitter,
  isForbiddenProperty,
  removeForbiddenProperties,
} from "../src/application/use-cases/emit-analytics-event";
import { trackEvent } from "../src/config/analytics";

/**
 * Critério de aceite do item C-05: existe teste que falha se uma propriedade
 * proibida for enviada.
 *
 * A verificação é feita no destino, e não na entrada, porque é o destino que um
 * dia será uma ferramenta de terceiro. O que importa provar é o que sai da
 * camada, não o que alguém tentou colocar nela.
 */

function recordingDestination() {
  const sent: AnalyticsEvent[] = [];
  const destination: AnalyticsDestination = { send: (event) => void sent.push(event) };
  return { destination, sent };
}

describe("catálogo de eventos", () => {
  it("declara os doze eventos da seção 8 do documento 05", () => {
    expect([...ANALYTICS_EVENTS]).toStrictEqual([
      "calculator_viewed",
      "calculation_started",
      "calculation_completed",
      "result_explained_opened",
      "price_simulated",
      "signup_started",
      "signup_completed",
      "first_service_saved",
      "plan_limit_reached",
      "checkout_started",
      "subscription_started",
      "subscription_cancelled",
    ]);
  });

  it("não emite nome fora do catálogo", () => {
    const { destination, sent } = recordingDestination();
    const emit = createAnalyticsEmitter(destination);

    expect(emit("evento_inventado" as never)).toBeNull();
    expect(sent).toHaveLength(0);
  });
});

describe("propriedades proibidas", () => {
  const forbiddenByName = [
    "preco",
    "precoSugerido",
    "price",
    "valorTotal",
    "custoTotal",
    "cost",
    "margem",
    "margin",
    "lucro",
    "faturamento",
    "taxaSobreVenda",
    "metaMensal",
    "nome",
    "nomeDoNegocio",
    "email",
    "e-mail",
    "telefone",
    "whatsapp",
    "cpf",
  ];

  it.each(forbiddenByName)("recusa a propriedade pelo nome: %s", (key) => {
    expect(isForbiddenProperty(key, "qualquer")).toBe(true);
    expect(removeForbiddenProperties({ [key]: "qualquer" })).toStrictEqual({});
  });

  it("recusa qualquer número, mesmo sob nome inocente", () => {
    expect(removeForbiddenProperties({ faixa: 171.43 })).toStrictEqual({});
    expect(removeForbiddenProperties({ duracao: 150 })).toStrictEqual({});
  });

  it("recusa valor que parece dinheiro, e-mail ou telefone", () => {
    expect(removeForbiddenProperties({ faixa: "R$ 171,43" })).toStrictEqual({});
    expect(removeForbiddenProperties({ faixa: "171,43" })).toStrictEqual({});
    expect(removeForbiddenProperties({ contato: "cliente@exemplo.com.br" })).toStrictEqual({});
    expect(removeForbiddenProperties({ contato: "95999998888" })).toStrictEqual({});
  });

  it("recusa o que não é texto nem sim/não", () => {
    expect(removeForbiddenProperties({ dados: { total: 10 } })).toStrictEqual({});
    expect(removeForbiddenProperties({ lista: ["a"] })).toStrictEqual({});
    expect(removeForbiddenProperties({ vazio: null })).toStrictEqual({});
  });

  it("mantém propriedade categórica", () => {
    expect(
      removeForbiddenProperties({
        origem: "home",
        faixaDeDuracao: "121-240",
        informouQuantoCobraHoje: true,
        descontaMaquininha: false,
      }),
    ).toStrictEqual({
      origem: "home",
      faixaDeDuracao: "121-240",
      informouQuantoCobraHoje: true,
      descontaMaquininha: false,
    });
  });
});

describe("emissão", () => {
  it("nunca entrega propriedade proibida ao destino", () => {
    const { destination, sent } = recordingDestination();
    const emit = createAnalyticsEmitter(destination);

    emit("calculation_completed", {
      origem: "home",
      precoSugerido: 171.43,
      custoTotal: 120,
      margem: 30,
      email: "profissional@exemplo.com.br",
      faixaDeDuracao: "121-240",
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toStrictEqual({
      name: "calculation_completed",
      properties: { origem: "home", faixaDeDuracao: "121-240" },
    });
  });

  it("não deixa nenhum número chegar ao destino, qualquer que seja o evento", () => {
    const { destination, sent } = recordingDestination();
    const emit = createAnalyticsEmitter(destination);

    for (const name of ANALYTICS_EVENTS) {
      emit(name, { origem: "home", qualquerCoisa: 42 });
    }

    for (const event of sent) {
      for (const value of Object.values(event.properties)) {
        expect(typeof value === "string" || typeof value === "boolean").toBe(true);
      }
    }
    expect(sent).toHaveLength(ANALYTICS_EVENTS.length);
  });

  it("não derruba a tela quando o destino falha", () => {
    const emit = createAnalyticsEmitter({
      send() {
        throw new Error("destino fora do ar");
      },
    });

    expect(() => emit("calculator_viewed", { origem: "home" })).not.toThrow();
    expect(emit("calculator_viewed", { origem: "home" })).toBeNull();
  });

  it("aplica a mesma proteção na camada já composta do produto", () => {
    expect(trackEvent("calculation_completed", { origem: "home", precoSugerido: 171.43 })).toStrictEqual({
      name: "calculation_completed",
      properties: { origem: "home" },
    });
  });
});
