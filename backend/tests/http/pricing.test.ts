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
