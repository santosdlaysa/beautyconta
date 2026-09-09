import { describe, expect, it } from "vitest";
import { setupApi } from "../support/api";

/**
 * Exclusão de conta com remoção efetiva, exigida por `RF-01` e `RF-12`.
 *
 * A cascata em si é garantia do banco — `users` leva junto negócios,
 * materiais, serviços, composição e histórico. Ela não aparece nesta suíte,
 * que roda em memória, e por isso está escrita no schema: `service_materials`
 * usa `onDelete: Cascade` justamente para que a exclusão atravesse até lá.
 * Recusar a exclusão de um material em uso continua sendo regra da aplicação,
 * com resposta explicada, e não violação de chave estrangeira.
 */
describe("exclusão de conta", () => {
  it("apaga a conta e invalida a sessão que fez o pedido", async () => {
    const { as, businessId } = await setupApi();

    await as().post(`/api/businesses/${businessId}/materials`).send({
      name: "Gel",
      category: "gel",
      purchasePriceCents: 8_000,
      purchaseQuantity: 30,
      unit: "g",
    });

    const removida = await as().delete("/api/users/me");
    expect(removida.status).toBe(204);

    // O token continua nas mãos de quem pediu, mas não vale mais nada.
    const depois = await as().get("/api/users/me");
    expect(depois.status).toBe(401);

    const dados = await as().get(`/api/businesses/${businessId}/materials`);
    expect(dados.status).toBe(401);
  });

  it("não deixa a conta excluída entrar de novo com a mesma senha", async () => {
    const { app, as } = await setupApi();
    const request = (await import("supertest")).default;

    await as().delete("/api/users/me");

    const { status } = await request(app)
      .post("/api/sessions")
      .send({ email: "marina@exemplo.com", password: "senha-de-teste" });

    expect(status).toBe(401);
  });
});
