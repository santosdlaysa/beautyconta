import { describe, expect, it } from "vitest";
import { createOtherUser, setupApi } from "../support/api";

/**
 * Item B-03: toda consulta filtra pelo negócio autorizado.
 *
 * A resposta para negócio alheio é a mesma de negócio inexistente. Distinguir
 * os dois já revelaria que o registro existe.
 */
describe("isolamento por negócio", () => {
  it("recusa leitura de negócio de outra pessoa", async () => {
    const { app, as, businessId } = await setupApi();
    const intrusa = await createOtherUser(app);

    const { status, body } = await as(intrusa.token).get(`/api/businesses/${businessId}`);

    expect(status).toBe(403);
    expect(body.error).toBe("forbidden");
  });

  it("recusa criar material em negócio alheio", async () => {
    const { app, as, businessId } = await setupApi();
    const intrusa = await createOtherUser(app);

    const { status } = await as(intrusa.token)
      .post(`/api/businesses/${businessId}/materials`)
      .send({
        name: "Material clandestino",
        category: "other",
        purchasePriceCents: 1_000,
        purchaseQuantity: 1,
        unit: "unit",
      });

    expect(status).toBe(403);
  });

  it("não lista dado de um negócio dentro de outro", async () => {
    const { app, as, businessId } = await setupApi();
    const intrusa = await createOtherUser(app);

    await as().post(`/api/businesses/${businessId}/materials`).send({
      name: "Gel da Marina",
      category: "gel",
      purchasePriceCents: 8_000,
      purchaseQuantity: 30,
      unit: "g",
    });

    const { body } = await as(intrusa.token).get(
      `/api/businesses/${intrusa.businessId}/materials`,
    );

    expect(body.items).toHaveLength(0);
  });

  it("recusa compor serviço com material de outro negócio", async () => {
    const { app, as, businessId } = await setupApi();
    const intrusa = await createOtherUser(app);

    const material = await as().post(`/api/businesses/${businessId}/materials`).send({
      name: "Gel da Marina",
      category: "gel",
      purchasePriceCents: 8_000,
      purchaseQuantity: 30,
      unit: "g",
    });

    const { status, body } = await as(intrusa.token)
      .post(`/api/businesses/${intrusa.businessId}/services`)
      .send({
        name: "Serviço com material alheio",
        category: "extension",
        durationMinutes: 60,
        desiredMarginPercent: 30,
        materials: [{ materialId: material.body.id, quantityUsed: 1 }],
      });

    expect(status).toBe(404);
    expect(body.error).toBe("not_found");
  });

  it("exige identidade nas rotas privadas", async () => {
    const { app, businessId } = await setupApi();
    const semIdentidade = await import("supertest").then((mod) =>
      mod.default(app).get(`/api/businesses/${businessId}/materials`),
    );

    expect(semIdentidade.status).toBe(401);
    expect(semIdentidade.body.error).toBe("unauthenticated");
  });
});
