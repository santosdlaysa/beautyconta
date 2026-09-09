import { describe, expect, it } from "vitest";
import { setupApi } from "../support/api";

const material = (index: number) => ({
  name: `Material ${index}`,
  category: "other",
  purchasePriceCents: 1_000,
  purchaseQuantity: 10,
  unit: "unit",
});

/** Item F-01: os limites do plano gratuito são verificados no servidor. */
describe("limites do plano gratuito", () => {
  it("aceita dez materiais e recusa o décimo primeiro sem apagar nada", async () => {
    const { as, businessId } = await setupApi();
    const base = `/api/businesses/${businessId}/materials`;

    for (let index = 1; index <= 10; index += 1) {
      const { status } = await as().post(base).send(material(index));
      expect(status).toBe(201);
    }

    const { status, body } = await as().post(base).send(material(11));

    expect(status).toBe(402);
    expect(body.error).toBe("plan_limit_reached");
    expect(body.resource).toBe("materials");
    expect(body.limit).toBe(10);
    // A mensagem promete duas coisas, e as duas importam para o item F-01.
    expect(body.message).toContain("Ao assinar, o cadastro fica sem limite");
    expect(body.message).toContain("Nada do que você já salvou é perdido");

    const list = await as().get(base);
    expect(list.body.items).toHaveLength(10);
  });

  it("recusa o quarto serviço no plano gratuito", async () => {
    const { as, businessId } = await setupApi();
    const base = `/api/businesses/${businessId}/services`;

    for (let index = 1; index <= 3; index += 1) {
      await as()
        .post(base)
        .send({
          name: `Serviço ${index}`,
          category: "extension",
          durationMinutes: 60,
          desiredMarginPercent: 30,
        });
    }

    const { status, body } = await as().post(base).send({
      name: "Serviço 4",
      category: "extension",
      durationMinutes: 60,
      desiredMarginPercent: 30,
    });

    expect(status).toBe(402);
    expect(body.resource).toBe("services");
  });

  it("recusa o sexto custo fixo no plano gratuito", async () => {
    const { as, businessId } = await setupApi();
    const base = `/api/businesses/${businessId}/fixed-costs`;

    for (let index = 1; index <= 5; index += 1) {
      await as()
        .post(base)
        .send({ name: `Custo ${index}`, category: "other", monthlyAmountCents: 10_000 });
    }

    const { status, body } = await as()
      .post(base)
      .send({ name: "Custo 6", category: "other", monthlyAmountCents: 10_000 });

    expect(status).toBe(402);
    expect(body.resource).toBe("fixedCosts");
  });

  it("não promete cadastro sem limite quando o plano pago também tem teto", async () => {
    const { as } = await setupApi();

    // O segundo negócio: o Premium permite cinco, não infinitos, e a mensagem
    // não pode prometer o que a assinatura não entrega.
    const { status, body } = await as()
      .post("/api/businesses")
      .send({ primaryCategory: "lashes", workModel: "home" });

    expect(status).toBe(402);
    expect(body.message).toContain("permite 1 negócio.");
    expect(body.message).not.toContain("sem limite");
  });

  it("libera o cadastro quando existe assinatura ativa", async () => {
    const { as, deps, businessId } = await setupApi();
    const base = `/api/businesses/${businessId}/materials`;

    for (let index = 1; index <= 10; index += 1) {
      await as().post(base).send(material(index));
    }

    deps.subscriptions.seedActive(businessId, "PREMIUM");

    const { status } = await as().post(base).send(material(11));
    expect(status).toBe(201);
  });

  it("mostra os cinco últimos cálculos e avisa que há mais guardados", async () => {
    const { as, businessId } = await setupApi();

    const entrada = {
      materialCost: 30,
      durationMinutes: 150,
      hourlyRate: 28,
      monthlyFixedCosts: 1_200,
      monthlyProductiveHours: 150,
      salesFeePercent: 0,
      desiredMarginPercent: 30,
    };

    for (let index = 0; index < 7; index += 1) {
      const { status } = await as()
        .post(`/api/businesses/${businessId}/calculations`)
        .send(entrada);
      expect(status).toBe(201);
    }

    const { body } = await as().get(`/api/businesses/${businessId}/calculations`);

    // Nenhum registro foi apagado: sete existem, cinco aparecem.
    expect(body.items).toHaveLength(5);
    expect(body.total).toBe(7);
    expect(body.limitedByPlan).toBe(true);
  });

  it("mostra o histórico completo no plano pago", async () => {
    const { as, deps, businessId } = await setupApi();
    deps.subscriptions.seedActive(businessId, "PREMIUM");

    for (let index = 0; index < 7; index += 1) {
      await as().post(`/api/businesses/${businessId}/calculations`).send({
        materialCost: 10,
        durationMinutes: 60,
        hourlyRate: 30,
        monthlyFixedCosts: 1_000,
        monthlyProductiveHours: 120,
        salesFeePercent: 0,
        desiredMarginPercent: 20,
      });
    }

    const { body } = await as().get(`/api/businesses/${businessId}/calculations`);

    expect(body.items).toHaveLength(7);
    expect(body.limitedByPlan).toBe(false);
  });
});
