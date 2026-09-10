import { describe, expect, it } from "vitest";
import { setupApi } from "../support/api";

/**
 * Preço a partir dos dados cadastrados e histórico imutável, itens E-04 e E-05.
 */
describe("preço do serviço cadastrado", () => {
  async function cenario() {
    const setup = await setupApi();
    const { as, businessId } = setup;

    await as().post(`/api/businesses/${businessId}/fixed-costs`).send({
      name: "Aluguel",
      category: "rent",
      monthlyAmountCents: 120_000,
    });

    const material = await as().post(`/api/businesses/${businessId}/materials`).send({
      name: "Gel construtor",
      category: "gel",
      purchasePriceCents: 9_000,
      purchaseQuantity: 30,
      unit: "g",
    });

    const service = await as()
      .post(`/api/businesses/${businessId}/services`)
      .send({
        name: "Alongamento",
        category: "extension",
        durationMinutes: 150,
        desiredMarginPercent: 30,
        salesFeePercent: 0,
        materials: [{ materialId: material.body.id, quantityUsed: 10 }],
      });

    return { ...setup, materialId: material.body.id as string, serviceId: service.body.id as string };
  }

  it("junta materiais, mão de obra e rateio conforme o documento 03", async () => {
    const { as, businessId, serviceId } = await cenario();

    const { status, body } = await as()
      .post(`/api/businesses/${businessId}/services/${serviceId}/pricing`)
      .send({});

    expect(status).toBe(200);
    // 9000 centavos / 30 g * 10 g = R$ 30,00 de material.
    expect(body.result.materialCost).toBe(30);
    // Retirada 4200 / 150 h = R$ 28/h, por 2,5 h.
    expect(body.result.laborCost).toBe(70);
    // 1200 de custo fixo / 150 h * 2,5 h.
    expect(body.result.allocatedFixedCost).toBe(20);
    expect(body.result.totalCost).toBe(120);
    expect(body.result.suggestedPrice).toBe(171.43);
    expect(body.saved).toBeNull();
  });

  it("exige a configuração da hora de trabalho antes de calcular", async () => {
    const setup = await setupApi({ withSettings: false });
    const { as, businessId } = setup;

    const service = await as().post(`/api/businesses/${businessId}/services`).send({
      name: "Esmaltação",
      category: "polish_application",
      durationMinutes: 60,
      desiredMarginPercent: 30,
    });

    const { status, body } = await as()
      .post(`/api/businesses/${businessId}/services/${service.body.id}/pricing`)
      .send({});

    expect(status).toBe(422);
    expect(body.field).toBe("settings");
  });

  it("guarda a fotografia da entrada: editar o material não muda o cálculo antigo", async () => {
    const { as, businessId, materialId, serviceId } = await cenario();

    const salvo = await as()
      .post(`/api/businesses/${businessId}/services/${serviceId}/pricing`)
      .send({ save: true });

    expect(salvo.status).toBe(201);
    expect(salvo.body.saved.materialCostCents).toBe(3_000);

    // O gel dobra de preço depois do cálculo.
    await as()
      .patch(`/api/businesses/${businessId}/materials/${materialId}`)
      .send({ purchasePriceCents: 18_000 });

    const historico = await as().get(
      `/api/businesses/${businessId}/calculations/${salvo.body.saved.id}`,
    );

    expect(historico.body.materialCostCents).toBe(3_000);
    expect(historico.body.inputSnapshot.materials[0].purchasePrice).toBe(90);

    // O cálculo novo, esse sim, usa o preço atualizado.
    const novo = await as()
      .post(`/api/businesses/${businessId}/services/${serviceId}/pricing`)
      .send({});
    expect(novo.body.result.materialCost).toBe(60);
  });

  it("recusa excluir serviço com histórico e sugere arquivar", async () => {
    const { as, businessId, serviceId } = await cenario();

    await as()
      .post(`/api/businesses/${businessId}/services/${serviceId}/pricing`)
      .send({ save: true });

    const { status, body } = await as().delete(
      `/api/businesses/${businessId}/services/${serviceId}`,
    );

    // A chave estrangeira é `SetNull`: excluir não falharia, mas o cálculo
    // passaria a aparecer como avulso e perderia de que serviço era o preço.
    expect(status).toBe(409);
    expect(body.message).toContain("Arquive");

    const historico = await as().get(`/api/businesses/${businessId}/calculations`);
    expect(historico.body.items[0].serviceId).toBe(serviceId);

    // Arquivar continua sendo o caminho, e preserva o vínculo.
    const arquivado = await as().post(
      `/api/businesses/${businessId}/services/${serviceId}/archive`,
    );
    expect(arquivado.body.isArchived).toBe(true);
  });

  it("permite excluir serviço que nunca gerou cálculo", async () => {
    const { as, businessId } = await cenario();

    const novo = await as().post(`/api/businesses/${businessId}/services`).send({
      name: "Serviço sem histórico",
      category: "polish_application",
      durationMinutes: 40,
      desiredMarginPercent: 20,
    });

    const { status } = await as().delete(
      `/api/businesses/${businessId}/services/${novo.body.id}`,
    );

    expect(status).toBe(204);
  });

  it("compara com o preço praticado hoje sem alterar o cadastro", async () => {
    const { as, businessId, serviceId } = await cenario();

    const { body } = await as()
      .post(`/api/businesses/${businessId}/services/${serviceId}/pricing`)
      .send({ currentPriceCents: 15_000 });

    expect(body.result.currentProfit).toBe(30);
    expect(body.result.currentMarginPercent).toBe(20);

    const servico = await as().get(`/api/businesses/${businessId}/services/${serviceId}`);
    expect(servico.body.currentPriceCents).toBeNull();
  });

  it("aplica a estratégia de arredondamento configurada", async () => {
    const { as, businessId, serviceId } = await cenario();

    await as().put(`/api/businesses/${businessId}/settings`).send({
      desiredMonthlyWithdrawalCents: 420_000,
      productiveHoursPerMonth: 150,
      estimatedAppointmentsPerMonth: 60,
      fixedCostAllocationMethod: "PRODUCTIVE_HOUR",
      roundingStrategy: "ENDING_90",
    });

    const { body } = await as()
      .post(`/api/businesses/${businessId}/services/${serviceId}/pricing`)
      .send({});

    expect(body.result.suggestedPrice).toBe(171.43);
    expect(body.result.commercialPrice).toBe(171.9);
  });

  it("rateia por atendimento quando a configuração pede", async () => {
    const { as, businessId, serviceId } = await cenario();

    await as().put(`/api/businesses/${businessId}/settings`).send({
      desiredMonthlyWithdrawalCents: 420_000,
      productiveHoursPerMonth: 150,
      estimatedAppointmentsPerMonth: 60,
      fixedCostAllocationMethod: "APPOINTMENT",
      roundingStrategy: "NONE",
    });

    const { body } = await as()
      .post(`/api/businesses/${businessId}/services/${serviceId}/pricing`)
      .send({});

    // 1200 de custo fixo dividido por 60 atendimentos.
    expect(body.result.allocatedFixedCost).toBe(20);
    expect(body.result.allocationMethod).toBe("appointment");
  });
});

/** Seção 6 do documento 07: a reserva entra no custo fixo e daí no rateio. */
describe("equipamentos no preço", () => {
  async function comEquipamento(campos: Record<string, unknown> = {}) {
    const setup = await setupApi();
    const { as, businessId } = setup;

    await as().post(`/api/businesses/${businessId}/fixed-costs`).send({
      name: "Aluguel",
      category: "rent",
      monthlyAmountCents: 120_000,
    });

    const servico = await as().post(`/api/businesses/${businessId}/services`).send({
      name: "Alongamento",
      category: "extension",
      durationMinutes: 150,
      desiredMarginPercent: 30,
    });

    const equipamento = await as().post(`/api/businesses/${businessId}/equipment`).send({
      name: "Cabine de luz",
      type: "uv_lamp",
      acquisitionPriceCents: 120_000,
      usefulLifeMonths: 36,
      acquisitionDate: new Date().toISOString().slice(0, 10),
      ...campos,
    });

    return { ...setup, serviceId: servico.body.id as string, equipamento };
  }

  it("a reserva soma ao custo fixo e aparece separada na composição", async () => {
    const { as, businessId, serviceId } = await comEquipamento();

    const { body } = await as()
      .post(`/api/businesses/${businessId}/services/${serviceId}/pricing`)
      .send({});

    // 1200 de aluguel mais 33,33 de reserva, rateados por 150 horas em 2,5 h.
    expect(body.fixedCostBreakdown).toEqual({
      expensesCents: 120_000,
      equipmentReserveCents: 3_333,
    });
    expect(body.result.allocatedFixedCost).toBeCloseTo(20.56, 2);
  });

  it("sem equipamento, o preço é o mesmo de antes", async () => {
    const { as, businessId } = await setupApi();

    await as().post(`/api/businesses/${businessId}/fixed-costs`).send({
      name: "Aluguel",
      category: "rent",
      monthlyAmountCents: 120_000,
    });
    const servico = await as().post(`/api/businesses/${businessId}/services`).send({
      name: "Alongamento",
      category: "extension",
      durationMinutes: 150,
      desiredMarginPercent: 30,
    });

    const { body } = await as()
      .post(`/api/businesses/${businessId}/services/${servico.body.id}/pricing`)
      .send({});

    expect(body.fixedCostBreakdown.equipmentReserveCents).toBe(0);
    expect(body.result.allocatedFixedCost).toBe(20);
  });

  it("equipamento com vida útil vencida não encarece mais o preço", async () => {
    const { as, businessId, serviceId } = await comEquipamento({
      usefulLifeMonths: 12,
      acquisitionDate: "2020-01-10",
    });

    const { body } = await as()
      .post(`/api/businesses/${businessId}/services/${serviceId}/pricing`)
      .send({});

    // Continuar cobrando por ele seria guardar dinheiro que já foi guardado.
    expect(body.fixedCostBreakdown.equipmentReserveCents).toBe(0);
  });

  it("recusa revenda maior que a compra, que distorceria todos os preços", async () => {
    const { equipamento } = await comEquipamento({ residualValueCents: 200_000 });

    expect(equipamento.status).toBe(422);
    expect(equipamento.body.field).toBe("residualValueCents");
  });

  it("aplica as mesmas regras ao editar, não só ao cadastrar", async () => {
    const { as, businessId, equipamento } = await comEquipamento();

    // Validar só na criação deixava o `PATCH` gravar o que o `POST` recusa — e
    // cada um desses valores distorce a reserva de todos os serviços.
    const revenda = await as()
      .patch(`/api/businesses/${businessId}/equipment/${equipamento.body.id}`)
      .send({ residualValueCents: 200_000 });
    expect(revenda.status).toBe(422);
    expect(revenda.body.field).toBe("residualValueCents");

    const futuro = await as()
      .patch(`/api/businesses/${businessId}/equipment/${equipamento.body.id}`)
      .send({ acquisitionDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) });
    expect(futuro.status).toBe(422);

    const vidaLonga = await as()
      .patch(`/api/businesses/${businessId}/equipment/${equipamento.body.id}`)
      .send({ usefulLifeMonths: 600 });
    expect(vidaLonga.status).toBe(422);
  });

  it("aceita edição válida e o preço acompanha", async () => {
    const { as, businessId, serviceId, equipamento } = await comEquipamento();

    // Metade da vida útil, dobro da reserva.
    await as()
      .patch(`/api/businesses/${businessId}/equipment/${equipamento.body.id}`)
      .send({ usefulLifeMonths: 18 });

    const { body } = await as()
      .post(`/api/businesses/${businessId}/services/${serviceId}/pricing`)
      .send({});

    expect(body.fixedCostBreakdown.equipmentReserveCents).toBe(6_667);
  });

  it("recusa data de compra no futuro", async () => {
    const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const { equipamento } = await comEquipamento({ acquisitionDate: amanha });

    expect(equipamento.status).toBe(422);
    expect(equipamento.body.field).toBe("acquisitionDate");
  });
});
