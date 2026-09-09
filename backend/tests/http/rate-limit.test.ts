import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { createTestDependencies } from "../support/in-memory";

/**
 * Teto de requisição nas rotas abertas.
 *
 * Sem ele, `POST /api/sessions` aceitava força bruta ilimitada — e, como cada
 * tentativa custa dezenas de milissegundos de scrypt no threadpool do Node,
 * derrubava junto a calculadora pública.
 */
describe("limite de tentativas", () => {
  it("barra a força bruta na entrada depois de dez tentativas", async () => {
    const app = createApp(createTestDependencies());
    const tentativa = () =>
      request(app).post("/api/sessions").send({ email: "alvo@exemplo.com", password: "errada" });

    // As dez primeiras são recusadas por senha, não por limite.
    for (let i = 0; i < 10; i += 1) {
      expect((await tentativa()).status).toBe(401);
    }

    const barrada = await tentativa();

    expect(barrada.status).toBe(429);
    expect(barrada.body.error).toBe("too_many_requests");
    expect(barrada.body.message).toMatch(/tentativas/i);
  });

  it("não barra a calculadora pública no mesmo ritmo", async () => {
    const app = createApp(createTestDependencies());

    // A calculadora é o mecanismo de aquisição do produto: várias pessoas podem
    // sair do mesmo endereço, de um salão ou de uma operadora móvel.
    for (let i = 0; i < 30; i += 1) {
      const { status } = await request(app).post("/api/pricing/calculate").send({
        durationMinutes: 60,
        hourlyRate: 50,
        monthlyFixedCosts: 0,
        monthlyProductiveHours: 100,
        salesFeePercent: 0,
        desiredMarginPercent: 20,
      });
      expect(status).toBe(200);
    }
  });

  it("conta cada aplicação separadamente, sem estado global entre elas", async () => {
    const primeira = createApp(createTestDependencies());
    const segunda = createApp(createTestDependencies());

    for (let i = 0; i < 11; i += 1) {
      await request(primeira).post("/api/sessions").send({ email: "a@exemplo.com", password: "x" });
    }

    // A segunda aplicação começa com o contador zerado.
    const { status } = await request(segunda)
      .post("/api/sessions")
      .send({ email: "a@exemplo.com", password: "x" });

    expect(status).toBe(401);
  });
});
