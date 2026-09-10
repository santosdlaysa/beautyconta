import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildOffers } from "../../src/domain/billing/plan-offers";
import { setupApi } from "../support/api";

/**
 * Catálogo de planos, item obrigatório para publicar nas lojas: Apple e Google
 * recusam a submissão quando o valor não aparece antes da compra.
 */
describe("catálogo de planos", () => {
  it("mostra o preço antes da compra, sem exigir conta", async () => {
    const { app } = await setupApi();

    // Sem cabeçalho de sessão: quem ainda não tem conta precisa ver o preço.
    const { status, body } = await request(app).get("/api/plans");

    expect(status).toBe(200);

    const mensal = body.offers.find(
      (offer: { billingPeriod: string }) => offer.billingPeriod === "MONTHLY",
    );
    expect(mensal.priceCents).toBe(2_990);
    expect(mensal.benefits.length).toBeGreaterThan(0);
  });

  it("leva os documentos que a loja exige na mesma tela do botão", async () => {
    const { app } = await setupApi();

    const { body } = await request(app).get("/api/plans");

    expect(body.legal.termsUrl).toMatch(/^https:\/\//);
    expect(body.legal.privacyUrl).toMatch(/^https:\/\//);
    expect(body.legal.supportEmail).toContain("@");
  });

  it("promete o mesmo teto que a API aplica", async () => {
    const { app } = await setupApi();

    const { body } = await request(app).get("/api/plans");

    // Se a tabela mudar num lugar só, a tela promete o que o servidor recusa.
    expect(body.limits.FREE.services).toBe(3);
    expect(body.limits.PREMIUM.services).toBeNull();
  });
});

describe("ofertas", () => {
  const mensal = { plan: "PREMIUM", billingPeriod: "MONTHLY", priceCents: 2_990 } as const;
  const anual = { plan: "PREMIUM", billingPeriod: "ANNUAL", priceCents: 29_900 } as const;

  it("sem preço configurado não há oferta, e a tela não mostra botão", () => {
    expect(buildOffers([])).toStrictEqual([]);
  });

  it("descarta preço zerado em vez de vender de graça", () => {
    expect(buildOffers([{ ...mensal, priceCents: 0 }])).toStrictEqual([]);
  });

  it("calcula quanto a anual sai por mês", () => {
    const [primeira] = buildOffers([anual]);

    expect(primeira?.monthlyEquivalentCents).toBe(2_492);
  });

  it("anuncia a economia sem arredondar para cima", () => {
    const [primeira] = buildOffers([mensal, anual]);

    // 12 x 29,90 = 358,80 contra 299,00: 16,66%, que se anuncia como 16.
    expect(buildOffers([mensal, anual]).find((o) => o.billingPeriod === "ANNUAL")?.savingsPercent).toBe(16);
    expect(primeira?.billingPeriod).toBe("ANNUAL");
  });

  it("não promete economia quando a anual não é mais barata", () => {
    const cara = { ...anual, priceCents: 2_990 * 12 };

    expect(buildOffers([mensal, cara]).find((o) => o.billingPeriod === "ANNUAL")?.savingsPercent).toBeNull();
  });

  it("não inventa comparação quando não existe mensal", () => {
    expect(buildOffers([anual])[0]?.savingsPercent).toBeNull();
  });

  it("ordena da mais barata por mês para a mais cara", () => {
    const ordem = buildOffers([mensal, anual]).map((offer) => offer.billingPeriod);

    expect(ordem).toStrictEqual(["ANNUAL", "MONTHLY"]);
  });
});
