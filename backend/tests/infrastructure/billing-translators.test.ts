import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MercadoPagoTranslator } from "../../src/infrastructure/billing/mercado-pago/translator";
import { RevenueCatTranslator } from "../../src/infrastructure/billing/revenuecat/translator";

/**
 * Tradutores de webhook.
 *
 * É o código que decide se alguém tem plano pago a partir de um corpo vindo da
 * internet. Merece teste próprio: aqui um engano não dá erro visível, dá acesso
 * indevido ou acesso perdido.
 */

const PRODUTOS = [
  { productId: "beautyconta_premium_monthly", plan: "PREMIUM", billingPeriod: "MONTHLY" },
  { productId: "beautyconta_master_annual", plan: "MASTER", billingPeriod: "ANNUAL" },
] as const;

const TOKEN = "segredo-do-painel";
const NEGOCIO = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

const evento = (overrides: Record<string, unknown> = {}) => ({
  event: {
    id: "evt-abc",
    type: "INITIAL_PURCHASE",
    app_user_id: NEGOCIO,
    product_id: "beautyconta_premium_monthly",
    store: "PLAY_STORE",
    original_transaction_id: "txn-1",
    purchased_at_ms: 1_760_000_000_000,
    expiration_at_ms: 1_762_600_000_000,
    ...overrides,
  },
});

describe("RevenueCat", () => {
  const translator = new RevenueCatTranslator(PRODUTOS, TOKEN);
  const autorizado = { authorization: TOKEN };

  it("traduz a compra inicial para assinatura ativa", () => {
    const result = translator.translate(evento(), autorizado);

    expect(result).not.toBeNull();
    expect(result?.businessId).toBe(NEGOCIO);
    expect(result?.externalEventId).toBe("evt-abc");
    expect(result?.subscription).toMatchObject({
      plan: "PREMIUM",
      status: "active",
      channel: "ANDROID",
      billingPeriod: "MONTHLY",
      providerSubscriptionId: "txn-1",
      cancelAtPeriodEnd: false,
    });
    expect(result?.subscription?.currentPeriodEnd).toEqual(new Date(1_762_600_000_000));
  });

  it("recusa evento sem o cabeçalho combinado", () => {
    expect(translator.translate(evento(), {})).toBeNull();
    expect(translator.translate(evento(), { authorization: "outro" })).toBeNull();
  });

  it("recusa tudo quando nenhum token foi configurado", () => {
    const semToken = new RevenueCatTranslator(PRODUTOS, null);
    expect(semToken.translate(evento(), autorizado)).toBeNull();
  });

  it("mantém o acesso no cancelamento até o fim do período pago", () => {
    const result = translator.translate(evento({ type: "CANCELLATION" }), autorizado);

    // Cancelar a renovação não devolve os dias que a assinante já pagou.
    expect(result?.subscription?.status).toBe("active");
    expect(result?.subscription?.cancelAtPeriodEnd).toBe(true);
  });

  it("encerra o acesso na expiração", () => {
    const result = translator.translate(evento({ type: "EXPIRATION" }), autorizado);
    expect(result?.subscription?.status).toBe("expired");
  });

  it("mantém o acesso durante a carência da cobrança falhada", () => {
    const result = translator.translate(evento({ type: "BILLING_ISSUE" }), autorizado);
    expect(result?.subscription?.status).toBe("in_grace");
  });

  it("reconhece a loja da Apple pelo campo `store`", () => {
    const result = translator.translate(evento({ store: "APP_STORE" }), autorizado);
    expect(result?.subscription?.channel).toBe("IOS");
  });

  it("mapeia o produto anual para o plano certo", () => {
    const result = translator.translate(
      evento({ product_id: "beautyconta_master_annual" }),
      autorizado,
    );

    expect(result?.subscription?.plan).toBe("MASTER");
    expect(result?.subscription?.billingPeriod).toBe("ANNUAL");
  });

  it("grava o evento mas não mexe no acesso quando o produto é desconhecido", () => {
    const result = translator.translate(evento({ product_id: "produto_que_nao_existe" }), autorizado);

    expect(result?.externalEventId).toBe("evt-abc");
    expect(result?.subscription).toBeNull();
  });

  it("recusa corpo sem identificador de evento", () => {
    expect(translator.translate({ event: { type: "RENEWAL" } }, autorizado)).toBeNull();
    expect(translator.translate(null, autorizado)).toBeNull();
  });

  it("não concede plano por compra de ambiente de teste", () => {
    const result = translator.translate(evento({ environment: "SANDBOX" }), autorizado);

    // Compra de sandbox é evento verdadeiro do ambiente errado: o bruto fica
    // gravado para auditoria, mas nada toca em `subscriptions`.
    expect(result?.externalEventId).toBe("evt-abc");
    expect(result?.subscription).toBeNull();
  });

  it("aceita ambiente de teste apenas quando explicitamente liberado", () => {
    const homologacao = new RevenueCatTranslator(PRODUTOS, TOKEN, true);
    const result = homologacao.translate(evento({ environment: "SANDBOX" }), autorizado);

    expect(result?.subscription?.plan).toBe("PREMIUM");
  });

  it("aceita a compra de produção", () => {
    const result = translator.translate(evento({ environment: "PRODUCTION" }), autorizado);
    expect(result?.subscription?.plan).toBe("PREMIUM");
  });
});

describe("Mercado Pago", () => {
  const SEGREDO = "segredo-mp";
  const notificacao = {
    id: 12_345,
    type: "subscription_preapproval",
    action: "updated",
    data: { id: "preapproval-1" },
  };

  /** Cabeçalhos que o Mercado Pago enviaria para este corpo. */
  const assinar = (dataId = "preapproval-1", requestId = "req-9") => {
    const ts = "1760000000";
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = createHmac("sha256", SEGREDO).update(manifest).digest("hex");
    return { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId };
  };

  const translator = new MercadoPagoTranslator(SEGREDO);

  it("registra a notificação assinada sem decidir o acesso", () => {
    const result = translator.translate(notificacao, assinar());

    expect(result?.externalEventId).toBe("mp:12345");
    expect(result?.type).toBe("updated");
    // O webhook do Mercado Pago avisa que algo mudou, não o que mudou.
    expect(result?.subscription).toBeNull();
  });

  it("recusa assinatura inválida ou ausente", () => {
    expect(translator.translate(notificacao, {})).toBeNull();
    expect(
      translator.translate(notificacao, {
        "x-signature": "ts=1760000000,v1=00",
        "x-request-id": "req-9",
      }),
    ).toBeNull();
  });

  it("recusa tudo quando nenhum segredo foi configurado", () => {
    // Falha fechada: esquecer a variável de ambiente não pode transformar o
    // webhook numa porta aberta para quem descobrir a URL.
    const semSegredo = new MercadoPagoTranslator(null);
    expect(semSegredo.translate(notificacao, assinar())).toBeNull();
  });

  it("cai para uma chave derivada quando a notificação não traz identificador", () => {
    const { id: _ignorado, ...semId } = notificacao;
    void _ignorado;

    const result = translator.translate(semId, assinar());

    // Ainda determinística, para que o reenvio continue sendo reconhecido.
    expect(result?.externalEventId).toBe("subscription_preapproval:preapproval-1:updated");
  });

  it("recusa corpo sem o identificador do recurso", () => {
    expect(translator.translate({ type: "payment" }, assinar())).toBeNull();
  });
});
