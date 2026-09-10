import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import {
  EMAIL_DA_ADMINISTRADORA,
  SEGREDO_DO_PAINEL,
  createTestDependencies,
} from "../support/in-memory";
import { SENHA_DE_TESTE, setupApi } from "../support/api";

/**
 * Painel administrativo.
 *
 * O que estes testes protegem, antes de qualquer funcionalidade: **este painel
 * atravessa contas de outras pessoas.** Uma rota desprotegida aqui entrega a
 * lista de usuárias e o preço de venda a quem descobrir a URL.
 */

const comSegredo = (app: ReturnType<typeof createApp>, caminho: string) =>
  request(app).get(caminho).set("x-admin-secret", SEGREDO_DO_PAINEL);

describe("quem entra no painel", () => {
  it("aceita o segredo do painel", async () => {
    const { app } = await setupApi();

    const { status } = await comSegredo(app, "/api/admin/overview");

    expect(status).toBe(200);
  });

  it("recusa sem credencial nenhuma", async () => {
    const { app } = await setupApi();

    const { status } = await request(app).get("/api/admin/overview");

    expect(status).toBe(401);
  });

  it("recusa segredo errado", async () => {
    const { app } = await setupApi();

    const { status } = await request(app)
      .get("/api/admin/overview")
      .set("x-admin-secret", "quase-o-segredo-certo");

    expect(status).toBe(401);
  });

  it("recusa a sessão de uma usuária comum", async () => {
    const { app, as } = await setupApi();
    void app;

    // Ter conta no BeautyConta não é ser administradora: sem esta linha,
    // qualquer assinante leria a lista de todas as outras.
    const { status } = await as().get("/api/admin/overview");

    expect(status).toBe(401);
  });

  it("aceita a sessão de quem está na lista de administradoras", async () => {
    const deps = createTestDependencies();
    const app = createApp(deps);

    const sessao = await request(app)
      .post("/api/users")
      .send({ name: "Admin", email: EMAIL_DA_ADMINISTRADORA, password: SENHA_DE_TESTE });

    const { status } = await request(app)
      .get("/api/admin/overview")
      .set("authorization", `Bearer ${sessao.body.token}`);

    expect(status).toBe(200);
  });

  it("sem segredo configurado, o cabeçalho deixa de valer", async () => {
    const deps = createTestDependencies();
    deps.admin = { secret: null, emails: [] };
    const app = createApp(deps);

    // Falha fechada: esquecer a variável não pode abrir o painel para todo mundo.
    const { status } = await request(app)
      .get("/api/admin/overview")
      .set("x-admin-secret", "qualquer-coisa");

    expect(status).toBe(401);
  });

  it("protege todas as rotas do painel, não só a primeira", async () => {
    const { app } = await setupApi();

    for (const caminho of ["/api/admin/plans", "/api/admin/users", "/api/admin/subscriptions"]) {
      const { status } = await request(app).get(caminho);
      expect(status).toBe(401);
    }
  });
});

describe("preços pelo painel", () => {
  async function painel() {
    const setup = await setupApi();
    return {
      ...setup,
      salvar: (body: Record<string, unknown>) =>
        request(setup.app)
          .put("/api/admin/plans")
          .set("x-admin-secret", SEGREDO_DO_PAINEL)
          .send(body),
    };
  }

  it("grava o preço e ele passa a valer na tela de venda", async () => {
    const { app, salvar } = await painel();

    const gravado = await salvar({
      plan: "PREMIUM",
      billingPeriod: "MONTHLY",
      priceCents: 3_990,
      benefits: ["Serviços sem limite"],
    });

    expect(gravado.status).toBe(200);
    expect(gravado.body.priceCents).toBe(3_990);

    // O catálogo público lê do banco, não do ambiente: sem isso, editar o preço
    // no painel não mudaria nada para quem está olhando a tela.
    const publico = await request(app).get("/api/plans");
    const mensal = publico.body.offers.find(
      (offer: { billingPeriod: string }) => offer.billingPeriod === "MONTHLY",
    );

    expect(mensal.priceCents).toBe(3_990);
    expect(mensal.benefits).toStrictEqual(["Serviços sem limite"]);
  });

  it("editar de novo não cria uma segunda oferta do mesmo plano", async () => {
    const { app, salvar } = await painel();

    await salvar({ plan: "PREMIUM", billingPeriod: "MONTHLY", priceCents: 2_990 });
    await salvar({ plan: "PREMIUM", billingPeriod: "MONTHLY", priceCents: 3_490 });

    const { body } = await comSegredo(app, "/api/admin/plans");

    expect(body.offers).toHaveLength(1);
    expect(body.offers[0].priceCents).toBe(3_490);
  });

  it("recusa preço zerado, que publicaria assinatura de graça", async () => {
    const { salvar } = await painel();

    const { status, body } = await salvar({
      plan: "PREMIUM",
      billingPeriod: "MONTHLY",
      priceCents: 0,
    });

    expect(status).toBe(422);
    expect(body.message).toMatch(/entre/i);
    expect(body.field).toBe("priceCents");
  });

  it("recusa preço absurdo, que costuma ser dedo escorregado", async () => {
    const { salvar } = await painel();

    const { status } = await salvar({
      plan: "PREMIUM",
      billingPeriod: "MONTHLY",
      priceCents: 9_999_999,
    });

    expect(status).toBe(422);
  });

  it("oferta desligada some da venda sem perder o preço", async () => {
    const { app, salvar } = await painel();

    await salvar({ plan: "PREMIUM", billingPeriod: "MONTHLY", priceCents: 2_990, isActive: false });

    const publico = await request(app).get("/api/plans");
    expect(publico.body.offers).toHaveLength(0);

    // O preço continua guardado, para religar depois sem redigitar.
    const painelVe = await comSegredo(app, "/api/admin/plans");
    expect(painelVe.body.offers[0].priceCents).toBe(2_990);
  });

  it("apaga a oferta quando pedido", async () => {
    const { app, salvar } = await painel();

    await salvar({ plan: "PREMIUM", billingPeriod: "ANNUAL", priceCents: 29_900 });

    const apagou = await request(app)
      .delete("/api/admin/plans/PREMIUM/ANNUAL")
      .set("x-admin-secret", SEGREDO_DO_PAINEL);

    expect(apagou.status).toBe(204);

    const { body } = await comSegredo(app, "/api/admin/plans");
    expect(body.offers).toHaveLength(0);
  });

  it("o preço cobrado no checkout é o do painel, não o do pedido", async () => {
    const { app, as, businessId, salvar } = await painel();

    await salvar({ plan: "PREMIUM", billingPeriod: "MONTHLY", priceCents: 4_990 });

    await as()
      .post(`/api/businesses/${businessId}/subscription/checkout`)
      .send({ plan: "PREMIUM", billingPeriod: "MONTHLY", priceCents: 1 });

    // O corpo do pedido não decide preço: aceitar o valor de quem chama deixaria
    // qualquer pessoa assinar por um centavo.
    const { body } = await request(app).get("/api/plans");
    expect(body.offers[0].priceCents).toBe(4_990);
  });
});

describe("o que o painel mostra", () => {
  it("promete o mesmo teto que a API aplica", async () => {
    const { app } = await setupApi();

    const { body } = await comSegredo(app, "/api/admin/plans");

    expect(body.limits.FREE.services).toBe(3);
    expect(body.limits.PREMIUM.services).toBeNull();
  });

  it("lista usuárias e assinaturas com o total, para paginar", async () => {
    const { app } = await setupApi();

    const usuarias = await comSegredo(app, "/api/admin/users");
    const assinaturas = await comSegredo(app, "/api/admin/subscriptions");

    expect(usuarias.body).toHaveProperty("total");
    expect(usuarias.body).toHaveProperty("items");
    expect(assinaturas.body).toHaveProperty("total");
  });

  it("recusa usuária inexistente sem estourar", async () => {
    const { app } = await setupApi();

    const { status } = await comSegredo(
      app,
      "/api/admin/users/00000000-0000-4000-8000-000000000009",
    );

    expect(status).toBe(422);
  });
});
