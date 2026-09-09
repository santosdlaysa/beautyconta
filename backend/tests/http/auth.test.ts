import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { createTestDependencies } from "../support/in-memory";
import { SENHA_DE_TESTE, setupApi } from "../support/api";

const conta = { name: "Marina", email: "marina@exemplo.com", password: "senha-bem-boa" };

function novaApi() {
  return createApp(createTestDependencies());
}

describe("POST /api/users", () => {
  it("cria a conta e já devolve a sessão", async () => {
    const { status, body } = await request(novaApi()).post("/api/users").send(conta);

    expect(status).toBe(201);
    expect(body.token).toEqual(expect.any(String));
    expect(body.user.email).toBe("marina@exemplo.com");
    // A senha não volta em campo nenhum, nem como hash.
    expect(JSON.stringify(body)).not.toContain(conta.password);
  });

  it("recusa senha curta dizendo qual campo falhou", async () => {
    const { status, body } = await request(novaApi())
      .post("/api/users")
      .send({ ...conta, password: "1234" });

    expect(status).toBe(422);
    expect(body.field).toBe("password");
  });

  it("recusa e-mail já cadastrado, ignorando maiúsculas", async () => {
    const app = novaApi();
    await request(app).post("/api/users").send(conta);

    const { status } = await request(app)
      .post("/api/users")
      .send({ ...conta, email: "MARINA@exemplo.com" });

    expect(status).toBe(409);
  });
});

describe("POST /api/sessions", () => {
  it("entra com e-mail e senha corretos", async () => {
    const app = novaApi();
    await request(app).post("/api/users").send(conta);

    const { status, body } = await request(app)
      .post("/api/sessions")
      .send({ email: conta.email, password: conta.password });

    expect(status).toBe(201);
    expect(body.token).toEqual(expect.any(String));
  });

  it("dá a mesma negativa para senha errada e para conta inexistente", async () => {
    const app = novaApi();
    await request(app).post("/api/users").send(conta);

    const senhaErrada = await request(app)
      .post("/api/sessions")
      .send({ email: conta.email, password: "outra-senha" });
    const contaInexistente = await request(app)
      .post("/api/sessions")
      .send({ email: "ninguem@exemplo.com", password: conta.password });

    expect(senhaErrada.status).toBe(401);
    expect(contaInexistente.status).toBe(401);
    expect(senhaErrada.body.message).toBe(contaInexistente.body.message);
  });
});

describe("sessão nas rotas privadas", () => {
  it("recusa requisição sem token", async () => {
    const { app } = await setupApi();

    const { status } = await request(app).get("/api/users/me");

    expect(status).toBe(401);
  });

  it("recusa token inventado", async () => {
    const { app } = await setupApi();

    const { status } = await request(app)
      .get("/api/users/me")
      .set("authorization", "Bearer token-que-nao-existe");

    expect(status).toBe(401);
  });

  it("não aceita mais o cabeçalho provisório de identidade", async () => {
    const { app, userId } = await setupApi();

    const { status } = await request(app).get("/api/users/me").set("x-user-id", userId);

    expect(status).toBe(401);
  });

  it("identifica a dona da conta com o token da sessão", async () => {
    const { as, userId } = await setupApi();

    const { status, body } = await as().get("/api/users/me");

    expect(status).toBe(200);
    expect(body.id).toBe(userId);
  });
});

describe("DELETE /api/sessions/current", () => {
  it("encerra apenas a sessão que fez o pedido", async () => {
    const { app, as, token } = await setupApi();
    const outraEntrada = await request(app)
      .post("/api/sessions")
      .send({ email: "marina@exemplo.com", password: SENHA_DE_TESTE });

    const saida = await as().delete("/api/sessions/current");

    expect(saida.status).toBe(204);
    expect((await as(token).get("/api/users/me")).status).toBe(401);
    expect((await as(outraEntrada.body.token).get("/api/users/me")).status).toBe(200);
  });
});

describe("PATCH /api/users/me/password", () => {
  it("troca a senha e derruba as sessões abertas", async () => {
    const { app, as, token } = await setupApi();

    const troca = await as()
      .patch("/api/users/me/password")
      .send({ currentPassword: SENHA_DE_TESTE, newPassword: "outra-senha-boa" });

    expect(troca.status).toBe(204);
    expect((await as(token).get("/api/users/me")).status).toBe(401);

    const novaEntrada = await request(app)
      .post("/api/sessions")
      .send({ email: "marina@exemplo.com", password: "outra-senha-boa" });

    expect(novaEntrada.status).toBe(201);
  });

  it("exige a senha atual correta", async () => {
    const { as } = await setupApi();

    const { status } = await as()
      .patch("/api/users/me/password")
      .send({ currentPassword: "chute", newPassword: "outra-senha-boa" });

    expect(status).toBe(401);
  });
});
