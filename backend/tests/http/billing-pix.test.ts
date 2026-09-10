import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { createTestDependencies } from "../support/in-memory";
import { SENHA_DE_TESTE } from "../support/api";
import type {
  BillingReference,
  BillingStateResolver,
  ResolvedSubscription,
} from "../../src/application/ports/billing";

/**
 * Do webhook até o plano concedido, quando a notificação não traz o estado.
 *
 * É o caminho do Mercado Pago: a notificação só aponta um recurso, e é a
 * consulta que revela o que aconteceu — inclusive de qual negócio se trata. Sem
 * este elo, o pagamento era aprovado e nunca virava acesso.
 */

/**
 * Resolvedor programável.
 *
 * A resposta é definida depois de o cenário existir, porque o negócio a que a
 * cobrança se refere só ganha identificador quando é criado.
 */
class ResolvedorDeMentira implements BillingStateResolver {
  readonly provider = "MERCADO_PAGO" as const;
  readonly consultas: BillingReference[] = [];
  resposta: ResolvedSubscription | null = null;

  resolve(reference: BillingReference): Promise<ResolvedSubscription | null> {
    this.consultas.push(reference);
    return Promise.resolve(this.resposta);
  }
}

/** Monta a API com o resolvedor pedido e uma conta pronta. */
async function cenario(resolver: BillingStateResolver | null) {
  const deps = createTestDependencies();
  deps.billingResolver = resolver;

  const app = createApp(deps);

  const session = await request(app)
    .post("/api/users")
    .send({ name: "Marina", email: "marina@exemplo.com", password: SENHA_DE_TESTE });

  const token: string = session.body.token;

  const business = await request(app)
    .post("/api/businesses")
    .set("authorization", `Bearer ${token}`)
    .send({ name: "Estúdio Marina", primaryCategory: "nails", workModel: "home" });

  const businessId: string = business.body.id;

  const planoAtual = async () => {
    const { body } = await request(app)
      .get(`/api/businesses/${businessId}/subscription`)
      .set("authorization", `Bearer ${token}`);
    return body;
  };

  return { app, token, businessId, planoAtual };
}

/** A notificação como ela chega: um aviso de que algo mudou, sem dizer o quê. */
const notificacao = {
  externalEventId: "mp-1",
  type: "payment.updated",
  reference: { type: "payment", externalId: "pay_1" },
};

const enviarWebhook = (app: ReturnType<typeof createApp>) =>
  request(app).post("/api/billing/webhooks/mercado-pago").send(notificacao);

describe("pagamento por Pix vira acesso", () => {
  it("consulta o provedor e concede o período comprado", async () => {
    const resolver = new ResolvedorDeMentira();
    const { app, businessId, planoAtual } = await cenario(resolver);

    const fim = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    resolver.resposta = {
      businessId,
      subscription: {
        plan: "PREMIUM",
        status: "active",
        channel: "WEB",
        billingPeriod: "MONTHLY",
        providerSubscriptionId: "payment:pay_1",
        currentPeriodEnd: fim,
        cancelAtPeriodEnd: true,
      },
    };

    const webhook = await enviarWebhook(app);

    expect(webhook.status).toBe(200);
    expect(resolver.consultas).toStrictEqual([{ type: "payment", externalId: "pay_1" }]);

    const plano = await planoAtual();
    expect(plano.plan).toBe("PREMIUM");
    // Pix não renova: o plano vale até a data, e a tela precisa poder dizer isso.
    expect(plano.subscriptions[0].cancelAtPeriodEnd).toBe(true);
  });

  it("não concede nada quando a consulta diz que o pagamento não foi aprovado", async () => {
    const resolver = new ResolvedorDeMentira();
    const { app, planoAtual } = await cenario(resolver);

    const webhook = await enviarWebhook(app);

    // O evento é aceito e gravado — o que não acontece é a mudança de acesso.
    expect(webhook.status).toBe(200);
    expect((await planoAtual()).plan).toBe("FREE");
  });

  it("ignora negócio que a consulta inventou", async () => {
    const resolver = new ResolvedorDeMentira();
    const { app, planoAtual } = await cenario(resolver);

    resolver.resposta = {
      businessId: "00000000-0000-4000-8000-000000000009",
      subscription: {
        plan: "PREMIUM",
        status: "active",
        channel: "WEB",
        billingPeriod: "MONTHLY",
        providerSubscriptionId: "payment:pay_2",
        cancelAtPeriodEnd: true,
      },
    };

    await enviarWebhook(app);

    // `external_reference` é texto livre no painel do provedor: um valor
    // inventado não pode virar plano para ninguém.
    expect((await planoAtual()).plan).toBe("FREE");
  });

  it("sem resolvedor configurado, grava o evento e não concede plano", async () => {
    const { app, planoAtual } = await cenario(null);

    const webhook = await enviarWebhook(app);

    expect(webhook.status).toBe(200);
    expect((await planoAtual()).plan).toBe("FREE");
  });

  it("a falha da consulta não derruba o webhook nem perde o evento", async () => {
    const quebrado: BillingStateResolver = {
      provider: "MERCADO_PAGO",
      resolve: () => Promise.reject(new Error("timeout")),
    };
    const { app, planoAtual } = await cenario(quebrado);

    // Devolver 500 faria o provedor reenviar; o evento já está gravado, e a
    // reentrega é justamente a chance de terminar o serviço.
    const webhook = await enviarWebhook(app);

    expect(webhook.status).toBe(200);
    expect((await planoAtual()).plan).toBe("FREE");
  });
});
