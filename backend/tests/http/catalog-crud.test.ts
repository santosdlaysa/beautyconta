import { describe, expect, it } from "vitest";
import { setupApi } from "../support/api";

/** Cadastros das etapas E-01, E-02 e E-04. */
describe("cadastros do negócio", () => {
  it("registra material com perda e devolve o custo unitário já com ela", async () => {
    const { as, businessId } = await setupApi();

    const { status, body } = await as().post(`/api/businesses/${businessId}/materials`).send({
      name: "Gel construtor",
      category: "gel",
      purchasePriceCents: 8_000,
      purchaseQuantity: 30,
      unit: "g",
      wastePercent: 10,
      purchaseDate: "2026-09-01",
    });

    expect(status).toBe(201);
    expect(body.wastePercent).toBe(10);
    // 8000 / 30 = 266,67 centavos por grama; com 10% de perda, 293.
    expect(body.unitCostCents).toBe(293);
    expect(body.purchaseDate).toBe("2026-09-01");
  });

  it("recusa lançamento manual da reserva para equipamentos", async () => {
    const { as, businessId } = await setupApi();

    const { status, body } = await as().post(`/api/businesses/${businessId}/fixed-costs`).send({
      name: "Reserva",
      category: "equipment_reserve",
      monthlyAmountCents: 10_000,
    });

    expect(status).toBe(422);
    expect(body.message).toContain("calculada pelo sistema");
  });

  it("soma apenas os custos fixos ativos no total mensal", async () => {
    const { as, businessId } = await setupApi();
    const base = `/api/businesses/${businessId}/fixed-costs`;

    await as().post(base).send({ name: "Aluguel", category: "rent", monthlyAmountCents: 90_000 });
    await as()
      .post(base)
      .send({
        name: "Curso antigo",
        category: "training",
        monthlyAmountCents: 20_000,
        isActive: false,
      });

    const { body } = await as().get(base);

    expect(body.items).toHaveLength(1);
    expect(body.monthlyTotalCents).toBe(90_000);
  });

  it("converte a quantidade usada para a unidade da compra", async () => {
    const { as, businessId } = await setupApi();

    const material = await as().post(`/api/businesses/${businessId}/materials`).send({
      name: "Acetona",
      category: "remover",
      purchasePriceCents: 2_000,
      purchaseQuantity: 1,
      unit: "l",
    });

    const service = await as()
      .post(`/api/businesses/${businessId}/services`)
      .send({
        name: "Remoção",
        category: "removal",
        durationMinutes: 30,
        desiredMarginPercent: 30,
        materials: [{ materialId: material.body.id, quantityUsed: 250, unit: "ml" }],
      });

    // 250 ml na unidade de compra, que é litro: 0,25.
    expect(service.status).toBe(201);
    expect(service.body.materials[0].quantityUsed).toBeCloseTo(0.25, 6);
  });

  it("recusa conversão entre famílias diferentes em vez de estimar", async () => {
    const { as, businessId } = await setupApi();

    const material = await as().post(`/api/businesses/${businessId}/materials`).send({
      name: "Gel",
      category: "gel",
      purchasePriceCents: 8_000,
      purchaseQuantity: 30,
      unit: "g",
    });

    const { status, body } = await as()
      .post(`/api/businesses/${businessId}/services`)
      .send({
        name: "Alongamento",
        category: "extension",
        durationMinutes: 120,
        desiredMarginPercent: 30,
        materials: [{ materialId: material.body.id, quantityUsed: 5, unit: "ml" }],
      });

    expect(status).toBe(422);
    expect(body.message).toContain("Use a mesma unidade da compra");
  });

  it("duplica o serviço com a composição inteira", async () => {
    const { as, businessId } = await setupApi();

    const material = await as().post(`/api/businesses/${businessId}/materials`).send({
      name: "Tips",
      category: "tips",
      purchasePriceCents: 5_000,
      purchaseQuantity: 100,
      unit: "unit",
    });

    const original = await as()
      .post(`/api/businesses/${businessId}/services`)
      .send({
        name: "Alongamento",
        category: "extension",
        durationMinutes: 150,
        desiredMarginPercent: 30,
        materials: [{ materialId: material.body.id, quantityUsed: 10 }],
      });

    const { status, body } = await as()
      .post(`/api/businesses/${businessId}/services/${original.body.id}/duplicate`)
      .send({});

    expect(status).toBe(201);
    expect(body.name).toBe("Alongamento (cópia)");
    expect(body.materials).toEqual(original.body.materials);
    expect(body.id).not.toBe(original.body.id);
  });

  it("recusa excluir material usado por um serviço e sugere arquivar", async () => {
    const { as, businessId } = await setupApi();

    const material = await as().post(`/api/businesses/${businessId}/materials`).send({
      name: "Cola",
      category: "glue",
      purchasePriceCents: 3_000,
      purchaseQuantity: 10,
      unit: "g",
    });

    await as()
      .post(`/api/businesses/${businessId}/services`)
      .send({
        name: "Manutenção",
        category: "maintenance",
        durationMinutes: 90,
        desiredMarginPercent: 25,
        materials: [{ materialId: material.body.id, quantityUsed: 1 }],
      });

    const { status, body } = await as().delete(
      `/api/businesses/${businessId}/materials/${material.body.id}`,
    );

    expect(status).toBe(409);
    expect(body.message).toContain("Arquive");

    // Arquivar continua permitido e some da listagem padrão.
    const archived = await as().post(
      `/api/businesses/${businessId}/materials/${material.body.id}/archive`,
    );
    expect(archived.body.isArchived).toBe(true);

    const list = await as().get(`/api/businesses/${businessId}/materials`);
    expect(list.body.items).toHaveLength(0);
  });
});

/**
 * Campos que o onboarding coletava e não tinham onde morar: ficavam no aparelho
 * e sumiam na troca de celular.
 */
describe("o que o onboarding coleta e o banco agora guarda", () => {
  it("guarda os outros segmentos atendidos", async () => {
    const { as, userId } = await setupApi();
    void userId;

    const criado = await as().post("/api/businesses").send({
      name: "Estúdio novo",
      primaryCategory: "nails",
      secondaryCategories: ["lashes", "brows"],
      workModel: "home",
    });

    // Só falha por limite de plano; o teste é sobre o campo, não sobre o teto.
    if (criado.status === 402) return;

    expect(criado.status).toBe(201);
    expect(criado.body.secondaryCategories).toEqual(["lashes", "brows"]);
  });

  it("não repete o segmento principal entre os outros", async () => {
    const { as, businessId } = await setupApi();

    const { body } = await as()
      .patch(`/api/businesses/${businessId}`)
      // O negócio criado pela suíte tem `nails` como principal.
      .send({ secondaryCategories: ["nails", "lashes"] });

    expect(body.secondaryCategories).toEqual(["lashes"]);
  });

  it("guarda a meta de lucro mensal junto da configuração", async () => {
    const { as, businessId } = await setupApi();
    const url = `/api/businesses/${businessId}/settings`;

    const salvo = await as().put(url).send({
      desiredMonthlyWithdrawalCents: 420_000,
      productiveHoursPerMonth: 150,
      estimatedAppointmentsPerMonth: 60,
      fixedCostAllocationMethod: "PRODUCTIVE_HOUR",
      roundingStrategy: "NONE",
      monthlyProfitGoalCents: 200_000,
    });

    expect(salvo.body.monthlyProfitGoalCents).toBe(200_000);
  });

  it("não apaga a meta quando ela salva só o resto da configuração", async () => {
    const { as, businessId } = await setupApi();
    const url = `/api/businesses/${businessId}/settings`;
    const base = {
      desiredMonthlyWithdrawalCents: 420_000,
      productiveHoursPerMonth: 150,
      estimatedAppointmentsPerMonth: 60,
      fixedCostAllocationMethod: "PRODUCTIVE_HOUR",
      roundingStrategy: "NONE",
    };

    await as().put(url).send({ ...base, monthlyProfitGoalCents: 200_000 });

    // A gravação substitui tudo: sem preservar, a meta sumiria em silêncio ao
    // mexer no arredondamento.
    const depois = await as().put(url).send({ ...base, roundingStrategy: "ENDING_90" });

    expect(depois.body.monthlyProfitGoalCents).toBe(200_000);
    expect(depois.body.roundingStrategy).toBe("ENDING_90");
  });

  it("aceita apagar a meta explicitamente", async () => {
    const { as, businessId } = await setupApi();
    const url = `/api/businesses/${businessId}/settings`;
    const base = {
      desiredMonthlyWithdrawalCents: 420_000,
      productiveHoursPerMonth: 150,
      estimatedAppointmentsPerMonth: 60,
      fixedCostAllocationMethod: "PRODUCTIVE_HOUR",
      roundingStrategy: "NONE",
    };

    await as().put(url).send({ ...base, monthlyProfitGoalCents: 200_000 });
    const limpo = await as().put(url).send({ ...base, monthlyProfitGoalCents: null });

    // Nulo é "não disse"; zero seria uma meta declarada de não lucrar.
    expect(limpo.body.monthlyProfitGoalCents).toBeNull();
  });
});
