import { describe, expect, it } from "vitest";
import { createOtherUser, setupApi } from "../support/api";

/** Exportação dos dados do negócio, `RF-12` e item G-01. */
describe("exportação de dados", () => {
  async function cenario() {
    const setup = await setupApi();
    const { as, businessId } = setup;

    const material = await as().post(`/api/businesses/${businessId}/materials`).send({
      name: "Gel construtor",
      category: "gel",
      purchasePriceCents: 9_000,
      purchaseQuantity: 30,
      unit: "g",
    });

    await as().post(`/api/businesses/${businessId}/materials/${material.body.id}/archive`);

    await as().post(`/api/businesses/${businessId}/fixed-costs`).send({
      name: "Aluguel antigo",
      category: "rent",
      monthlyAmountCents: 90_000,
      isActive: false,
    });

    await as()
      .post(`/api/businesses/${businessId}/services`)
      .send({
        name: "Alongamento",
        category: "extension",
        durationMinutes: 150,
        desiredMarginPercent: 30,
        materials: [{ materialId: material.body.id, quantityUsed: 10 }],
      });

    // Sete cálculos: mais do que a janela de cinco do plano gratuito.
    for (let index = 0; index < 7; index += 1) {
      await as().post(`/api/businesses/${businessId}/calculations`).send({
        materialCost: 30,
        durationMinutes: 150,
        hourlyRate: 28,
        monthlyFixedCosts: 1_200,
        monthlyProductiveHours: 150,
        salesFeePercent: 0,
        desiredMarginPercent: 30,
      });
    }

    return setup;
  }

  it("leva tudo, inclusive o que a interface não mostra", async () => {
    const { as, businessId } = await cenario();

    const { status, body, headers } = await as().get(`/api/businesses/${businessId}/export`);

    expect(status).toBe(200);
    expect(headers["content-disposition"]).toContain("attachment");
    expect(headers["content-disposition"]).toContain("beautyconta-");

    expect(body.business.id).toBe(businessId);
    expect(body.settings).not.toBeNull();
    expect(body.services).toHaveLength(1);

    // Arquivado e inativo entram: quem exporta quer o que tem, não o que a tela
    // mostra hoje.
    expect(body.materials).toHaveLength(1);
    expect(body.materials[0].isArchived).toBe(true);
    expect(body.fixedCosts).toHaveLength(1);
    expect(body.fixedCosts[0].isActive).toBe(false);

    // O histórico completo, e não a janela de cinco do plano gratuito: negar a
    // cópia do que é da pessoa por causa de plano seria usar a proteção de
    // dados como alavanca de venda.
    expect(body.calculations).toHaveLength(7);
    expect(body.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("recusa exportar negócio de outra pessoa", async () => {
    const { app, as, businessId } = await cenario();
    const intrusa = await createOtherUser(app);

    const { status } = await as(intrusa.token).get(`/api/businesses/${businessId}/export`);

    expect(status).toBe(403);
  });

  it("exige identidade", async () => {
    const { app, businessId } = await cenario();
    const request = (await import("supertest")).default;

    const { status } = await request(app).get(`/api/businesses/${businessId}/export`);

    expect(status).toBe(401);
  });
});
