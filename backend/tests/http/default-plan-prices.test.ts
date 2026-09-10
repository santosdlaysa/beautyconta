import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { parsePriceList } from "../../src/config/plan-prices";
import { setupApi } from "../support/api";

describe("preços do Premium sem configuração de ambiente", () => {
  it("publica mensal e anual e cobra o mesmo preço exibido", async () => {
    const { app, deps, as, businessId } = await setupApi();
    deps.plans.prices = parsePriceList(undefined);

    const { body, status } = await request(app).get("/api/plans");
    expect(status).toBe(200);
    expect(body.offers).toEqual(expect.arrayContaining([
      expect.objectContaining({ plan: "PREMIUM", billingPeriod: "MONTHLY", priceCents: 1490 }),
      expect.objectContaining({ plan: "PREMIUM", billingPeriod: "ANNUAL", priceCents: 14990 }),
    ]));
    expect(body.offers).toHaveLength(2);

    for (const offer of body.offers) {
      const checkout = await as().post(`/api/businesses/${businessId}/subscription/checkout`)
        .send({ plan: offer.plan, billingPeriod: offer.billingPeriod });
      expect(checkout.status).toBe(201);
      expect(deps.gateway.checkouts.at(-1)?.priceCents).toBe(offer.priceCents);
    }
  });

  it("preserva os preços configurados", () => {
    expect(parsePriceList("PREMIUM:MONTHLY:1990")).toEqual([
      { plan: "PREMIUM", billingPeriod: "MONTHLY", priceCents: 1990 },
    ]);
  });

  it("permite desativar explicitamente o catálogo", () => {
    expect(parsePriceList("")).toEqual([]);
  });

  it("não substitui uma configuração inválida por preços padrão", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      expect(parsePriceList("PREMIUM:MONTHLY:0,FREE:MONTHLY:1490")).toEqual([]);
    } finally {
      warning.mockRestore();
    }
  });
});
