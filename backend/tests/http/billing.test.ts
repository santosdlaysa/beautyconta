import request from "supertest";
import { describe, expect, it } from "vitest";
import { setupApi } from "../support/api";

const evento = (businessId: string, overrides: Record<string, unknown> = {}) => ({
  externalEventId: "evt-1",
  type: "INITIAL_PURCHASE",
  businessId,
  subscription: {
    plan: "PREMIUM",
    status: "active",
    channel: "ANDROID",
    billingPeriod: "MONTHLY",
    providerSubscriptionId: "sub-1",
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  },
  ...overrides,
});

describe("assinatura e cobrança", () => {
  it("começa no plano gratuito com os limites do documento 01", async () => {
    const { as, businessId } = await setupApi();

    const { status, body } = await as().get(`/api/businesses/${businessId}/subscription`);

    expect(status).toBe(200);
    expect(body.plan).toBe("FREE");
    expect(body.limits).toEqual({
      businesses: 1,
      materials: 10,
      services: 3,
      fixedCosts: 5,
      calculations: 5,
    });
    expect(body.managedIn).toBeNull();
  });

  it("grava o evento bruto e passa a conceder o plano pago", async () => {
    const { app, as, deps, businessId } = await setupApi();

    const webhook = await request(app)
      .post("/api/billing/webhooks/revenuecat")
      .send(evento(businessId));

    expect(webhook.status).toBe(200);
    expect(webhook.body.status).toBe("recorded");
    expect(deps.billingEvents.items.size).toBe(1);

    const status = await as().get(`/api/businesses/${businessId}/subscription`);
    expect(status.body.plan).toBe("PREMIUM");
    expect(status.body.managedIn).toBe("ANDROID");
  });

  it("é idempotente: o reenvio do mesmo evento não duplica nada", async () => {
    const { app, deps, businessId } = await setupApi();

    await request(app).post("/api/billing/webhooks/revenuecat").send(evento(businessId));
    const reenvio = await request(app)
      .post("/api/billing/webhooks/revenuecat")
      .send(evento(businessId));

    expect(reenvio.status).toBe(200);
    expect(reenvio.body.status).toBe("duplicated");
    expect(deps.billingEvents.items.size).toBe(1);
    expect(deps.subscriptions.items.size).toBe(1);
  });

  it("recusa payload irreconhecível com 400, porque reenviar não adianta", async () => {
    const { app } = await setupApi();

    const { status, body } = await request(app)
      .post("/api/billing/webhooks/mercado-pago")
      .send({ qualquer: "coisa" });

    expect(status).toBe(400);
    expect(body.status).toBe("rejected");
  });

  it("degrada para o gratuito quando a assinatura expira, sem apagar dado", async () => {
    const { app, as, businessId } = await setupApi();

    await as().post(`/api/businesses/${businessId}/materials`).send({
      name: "Gel",
      category: "gel",
      purchasePriceCents: 8_000,
      purchaseQuantity: 30,
      unit: "g",
    });

    await request(app).post("/api/billing/webhooks/revenuecat").send(evento(businessId));

    await request(app)
      .post("/api/billing/webhooks/revenuecat")
      .send(
        evento(businessId, {
          externalEventId: "evt-2",
          type: "EXPIRATION",
          subscription: {
            plan: "PREMIUM",
            status: "expired",
            channel: "ANDROID",
            billingPeriod: "MONTHLY",
            providerSubscriptionId: "sub-1",
            currentPeriodEnd: new Date(Date.now() - 1_000).toISOString(),
          },
        }),
      );

    const status = await as().get(`/api/businesses/${businessId}/subscription`);
    expect(status.body.plan).toBe("FREE");

    const materiais = await as().get(`/api/businesses/${businessId}/materials`);
    expect(materiais.body.items).toHaveLength(1);
  });

  it("recusa checkout quando já existe assinatura ativa em outro canal", async () => {
    const { app, as, businessId } = await setupApi();

    await request(app).post("/api/billing/webhooks/revenuecat").send(evento(businessId));

    const { status, body } = await as()
      .post(`/api/businesses/${businessId}/subscription/checkout`)
      .send({ plan: "PREMIUM", billingPeriod: "MONTHLY" });

    expect(status).toBe(409);
    expect(body.message).toContain("Google Play");
  });

  it("abre o checkout quando não há cobrança em outro canal", async () => {
    const { as, deps, businessId } = await setupApi();

    const { status, body } = await as()
      .post(`/api/businesses/${businessId}/subscription/checkout`)
      .send({ plan: "PREMIUM", billingPeriod: "MONTHLY" });

    expect(status).toBe(201);
    expect(body.checkoutUrl).toContain(businessId);
    expect(deps.gateway.checkouts).toHaveLength(1);
  });
});
