import { describe, expect, it, vi } from "vitest";
import { MercadoPagoError, MercadoPagoGateway } from "../../src/infrastructure/billing/mercado-pago/gateway";

/**
 * O gateway do Mercado Pago, exercitado sem rede.
 *
 * O `fetch` é injetado justamente para isto: o que precisa ser verificado é o
 * corpo que sai daqui e a leitura do que volta — não a disponibilidade da API
 * deles.
 */

const CONFIG = {
  accessToken: "TEST-token",
  returnUrl: "https://beautyconta.com.br/assinatura",
  webhookUrl: "https://api.beautyconta.com.br/api/billing/mercado-pago",
};

/** Resposta de sucesso pronta, para o teste falar só do que importa. */
function respondeCom(body: unknown, ok = true, status = 200) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    void _url;
    void _init;
    return {
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  });
}

const PEDIDO = {
  businessId: "b1e7c0de-0000-4000-8000-000000000001",
  plan: "PREMIUM" as const,
  billingPeriod: "MONTHLY" as const,
  priceCents: 2_990,
};

describe("checkout no cartão", () => {
  it("cria assinatura recorrente com o valor do catálogo", async () => {
    const fetchFalso = respondeCom({ id: "pre_1", init_point: "https://mp.test/pagar" });
    const gateway = new MercadoPagoGateway(CONFIG, fetchFalso);

    const session = await gateway.createCheckout({ ...PEDIDO, paymentMethod: "card" });

    expect(session.checkoutUrl).toBe("https://mp.test/pagar");
    expect(session.providerSubscriptionId).toBe("pre_1");
    expect(session.paymentMethod).toBe("card");

    const [url, init] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/preapproval");

    const corpo = JSON.parse(String(init.body));
    // Centavos viram decimal só aqui, na borda: 2990 centavos são 29,90.
    expect(corpo.auto_recurring.transaction_amount).toBe(29.9);
    expect(corpo.auto_recurring.frequency).toBe(1);
    // Sem `external_reference` o webhook não sabe de quem é a cobrança.
    expect(corpo.external_reference).toBe(PEDIDO.businessId);
  });

  it("cobra o plano anual a cada doze meses, não a cada mês", async () => {
    const fetchFalso = respondeCom({ id: "pre_2", init_point: "https://mp.test/pagar" });
    const gateway = new MercadoPagoGateway(CONFIG, fetchFalso);

    await gateway.createCheckout({
      ...PEDIDO,
      billingPeriod: "ANNUAL",
      priceCents: 29_900,
      paymentMethod: "card",
    });

    const corpo = JSON.parse(String((fetchFalso.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(corpo.auto_recurring.frequency).toBe(12);
    expect(corpo.auto_recurring.transaction_amount).toBe(299);
  });

  it("recusa em voz alta quando o Mercado Pago não devolve o endereço", async () => {
    const gateway = new MercadoPagoGateway(CONFIG, respondeCom({ id: "pre_3" }));

    // Devolver uma sessão sem endereço mandaria a assinante para lugar nenhum.
    await expect(gateway.createCheckout({ ...PEDIDO, paymentMethod: "card" })).rejects.toThrow(
      MercadoPagoError,
    );
  });

  it("não vaza o corpo do erro do provedor para a assinante", async () => {
    const fetchFalso = respondeCom({ message: "invalid card token", cause: [] }, false, 400);
    const gateway = new MercadoPagoGateway(CONFIG, fetchFalso);

    await expect(gateway.createCheckout({ ...PEDIDO, paymentMethod: "card" })).rejects.toThrow(
      /Não foi possível falar com o Mercado Pago/,
    );
  });
});

describe("checkout no Pix", () => {
  it("cria pagamento avulso, e só por Pix", async () => {
    const fetchFalso = respondeCom({ id: "pref_1", init_point: "https://mp.test/pix" });
    const gateway = new MercadoPagoGateway(CONFIG, fetchFalso);

    const session = await gateway.createCheckout({ ...PEDIDO, paymentMethod: "pix" });

    expect(session.paymentMethod).toBe("pix");

    const [url, init] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/checkout/preferences");

    const corpo = JSON.parse(String(init.body));
    expect(corpo.items[0].unit_price).toBe(29.9);
    expect(corpo.external_reference).toBe(PEDIDO.businessId);

    // Cartão fora da preferência: ele tem caminho próprio, que renova sozinho.
    // Deixar os dois aqui venderia como avulso o que deveria ser assinatura.
    const excluidos = corpo.payment_methods.excluded_payment_types.map((t: { id: string }) => t.id);
    expect(excluidos).toContain("credit_card");
    expect(excluidos).toContain("debit_card");
  });

  it("leva o endereço do webhook, sem o qual o pagamento nunca vira acesso", async () => {
    const fetchFalso = respondeCom({ id: "pref_2", init_point: "https://mp.test/pix" });
    const gateway = new MercadoPagoGateway(CONFIG, fetchFalso);

    await gateway.createCheckout({ ...PEDIDO, paymentMethod: "pix" });

    const corpo = JSON.parse(String((fetchFalso.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(corpo.notification_url).toBe(CONFIG.webhookUrl);
  });
});

describe("leitura do que o provedor informa", () => {
  it("pagamento aprovado concede o período comprado, sem renovar", async () => {
    const fetchFalso = respondeCom({
      status: "approved",
      external_reference: PEDIDO.businessId,
      date_approved: "2026-09-10T12:00:00.000Z",
      additional_info: { items: [{ id: "PREMIUM_MONTHLY" }] },
    });
    const gateway = new MercadoPagoGateway(CONFIG, fetchFalso);

    const resolved = await gateway.resolve({ type: "payment", externalId: "pay_1" });

    expect(resolved?.businessId).toBe(PEDIDO.businessId);
    expect(resolved?.subscription.status).toBe("active");
    expect(resolved?.subscription.currentPeriodEnd?.toISOString()).toBe("2026-10-10T12:00:00.000Z");
    // Pix não renova: a assinatura nasce sabendo o dia em que termina.
    expect(resolved?.subscription.cancelAtPeriodEnd).toBe(true);
  });

  it("plano anual pago por Pix vale um ano", async () => {
    const fetchFalso = respondeCom({
      status: "approved",
      external_reference: PEDIDO.businessId,
      date_approved: "2026-09-10T12:00:00.000Z",
      additional_info: { items: [{ id: "PREMIUM_ANNUAL" }] },
    });
    const gateway = new MercadoPagoGateway(CONFIG, fetchFalso);

    const resolved = await gateway.resolve({ type: "payment", externalId: "pay_2" });

    expect(resolved?.subscription.billingPeriod).toBe("ANNUAL");
    expect(resolved?.subscription.currentPeriodEnd?.toISOString()).toBe("2027-09-10T12:00:00.000Z");
  });

  it("pagamento não aprovado não concede nada", async () => {
    for (const status of ["pending", "rejected", "refunded", "in_process"]) {
      const gateway = new MercadoPagoGateway(
        CONFIG,
        respondeCom({ status, external_reference: PEDIDO.businessId }),
      );

      // Conceder para depois tirar seria dar acesso a quem não pagou.
      expect(await gateway.resolve({ type: "payment", externalId: "pay_x" })).toBeNull();
    }
  });

  it("pagamento sem referência de negócio é ignorado, não adivinhado", async () => {
    const gateway = new MercadoPagoGateway(CONFIG, respondeCom({ status: "approved" }));

    expect(await gateway.resolve({ type: "payment", externalId: "pay_y" })).toBeNull();
  });

  it("assinatura autorizada fica ativa e renovando", async () => {
    const fetchFalso = respondeCom({
      status: "authorized",
      external_reference: PEDIDO.businessId,
      reason: "BeautyConta Premium — mensal",
      auto_recurring: { frequency: 1, frequency_type: "months" },
      date_created: "2026-09-10T12:00:00.000Z",
      next_payment_date: "2026-10-10T12:00:00.000Z",
    });
    const gateway = new MercadoPagoGateway(CONFIG, fetchFalso);

    const resolved = await gateway.resolve({ type: "subscription_preapproval", externalId: "pre_1" });

    expect(resolved?.subscription.status).toBe("active");
    expect(resolved?.subscription.cancelAtPeriodEnd).toBe(false);
    expect(resolved?.subscription.mpPreapprovalId).toBe("pre_1");
  });

  it("assinatura cancelada mantém o acesso até o fim do período pago", async () => {
    const fetchFalso = respondeCom({
      status: "cancelled",
      external_reference: PEDIDO.businessId,
      reason: "BeautyConta Premium — mensal",
      auto_recurring: { frequency: 1 },
      next_payment_date: "2026-10-10T12:00:00.000Z",
    });
    const gateway = new MercadoPagoGateway(CONFIG, fetchFalso);

    const resolved = await gateway.resolve({ type: "preapproval", externalId: "pre_2" });

    // Cancelar a renovação não encerra o período já pago; quem encerra é a data.
    expect(resolved?.subscription.status).toBe("active");
    expect(resolved?.subscription.cancelAtPeriodEnd).toBe(true);
  });

  it("assinatura ainda pendente não concede plano", async () => {
    const gateway = new MercadoPagoGateway(
      CONFIG,
      respondeCom({ status: "pending", external_reference: PEDIDO.businessId }),
    );

    expect(await gateway.resolve({ type: "preapproval", externalId: "pre_3" })).toBeNull();
  });

  it("notificação de outro assunto não vira consulta", async () => {
    const fetchFalso = respondeCom({});
    const gateway = new MercadoPagoGateway(CONFIG, fetchFalso);

    expect(await gateway.resolve({ type: "merchant_order", externalId: "mo_1" })).toBeNull();
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});

describe("cancelamento", () => {
  it("pede o cancelamento da assinatura recorrente", async () => {
    const fetchFalso = respondeCom({ status: "cancelled" });
    const gateway = new MercadoPagoGateway(CONFIG, fetchFalso);

    await gateway.cancel("pre_1");

    const [url, init] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/preapproval/pre_1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body)).status).toBe("cancelled");
  });
});
