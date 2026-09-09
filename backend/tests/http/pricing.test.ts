import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";

const app = createApp();

/** Entrada do exemplo completo da seção 8 do documento 03. */
const exemploDoDocumento = {
  materialCost: 30,
  durationMinutes: 150,
  hourlyRate: 28,
  monthlyFixedCosts: 1200,
  monthlyProductiveHours: 150,
  salesFeePercent: 0,
  desiredMarginPercent: 30,
};

describe("POST /api/pricing/goal", () => {
  it("projeta o preço da meta e diz quantos atendimentos ela exige hoje", async () => {
    const { status, body } = await request(app).post("/api/pricing/goal").send({
      totalCost: 120,
      monthlyProfitGoal: 2000,
      monthlyAppointments: 40,
      currentPrice: 200,
    });

    expect(status).toBe(200);
    expect(body.profitPerAppointment).toBe(50);
    expect(body.projectedPrice).toBe(170);
    expect(body.appointmentsNeededAtCurrentPrice).toBe(25);
    // A saída é rotulada como projeção, exigência do item A-04.
    expect(body.disclaimer).toMatch(/não é garantia/i);
  });

  it("não promete volume quando o preço atual não cobre o custo", async () => {
    const { body } = await request(app).post("/api/pricing/goal").send({
      totalCost: 120,
      monthlyProfitGoal: 2000,
      monthlyAppointments: 40,
      currentPrice: 100,
    });

    expect(body.appointmentsNeededAtCurrentPrice).toBeNull();
  });

  it("recusa meta sem atendimentos estimados", async () => {
    const { status, body } = await request(app)
      .post("/api/pricing/goal")
      .send({ totalCost: 120, monthlyProfitGoal: 2000, monthlyAppointments: 0 });

    expect(status).toBe(422);
    expect(body.field).toBe("monthlyAppointments");
  });
});

describe("POST /api/pricing/calculate", () => {
  it("reproduz o exemplo do documento 03", async () => {
    const { status, body } = await request(app).post("/api/pricing/calculate").send(exemploDoDocumento);

    expect(status).toBe(200);
    expect(body.totalCost).toBe(120);
    expect(body.suggestedPrice).toBe(171.43);
    expect(body.expectedProfit).toBe(51.43);
  });

  it("recusa duração fora da faixa e diz qual campo falhou", async () => {
    const { status, body } = await request(app)
      .post("/api/pricing/calculate")
      .send({ ...exemploDoDocumento, durationMinutes: 0 });

    expect(status).toBe(422);
    expect(body.field).toBe("durationMinutes");
  });

  it("recusa soma de taxa e margem maior ou igual a 100%", async () => {
    const { status, body } = await request(app)
      .post("/api/pricing/calculate")
      .send({ ...exemploDoDocumento, salesFeePercent: 20, desiredMarginPercent: 90 });

    expect(status).toBe(422);
    expect(body.message).toMatch(/100%/);
  });

  it("compara com o preço atual quando informado", async () => {
    const { body } = await request(app)
      .post("/api/pricing/calculate")
      .send({ ...exemploDoDocumento, currentPrice: 140 });

    expect(body.currentProfit).toBe(20);
  });

  it("responde ao health check", async () => {
    const { status, body } = await request(app).get("/health");

    expect(status).toBe(200);
    expect(body.status).toBe("ok");
  });
});
