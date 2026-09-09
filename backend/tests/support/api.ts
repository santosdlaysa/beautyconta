import request from "supertest";
import { createApp } from "../../src/app";
import { createTestDependencies, type TestDependencies } from "./in-memory";

/**
 * Monta a API sobre repositórios em memória e deixa uma conta pronta.
 *
 * A identidade viaja como a do aplicativo: cadastro devolve token de sessão e
 * toda requisição privada leva `Authorization: Bearer`. Os testes exercitam,
 * assim, o mesmo caminho de autenticação que a usuária percorre.
 */
export const SENHA_DE_TESTE = "senha-de-teste";

export async function setupApi(options: { withSettings?: boolean } = {}) {
  const deps: TestDependencies = createTestDependencies();
  const app = createApp(deps);

  const session = await request(app)
    .post("/api/users")
    .send({ name: "Marina", email: "Marina@Exemplo.com", password: SENHA_DE_TESTE });

  const token: string = session.body.token;
  const userId: string = session.body.user.id;

  const business = await request(app)
    .post("/api/businesses")
    .set("authorization", `Bearer ${token}`)
    .send({ name: "Estúdio Marina", primaryCategory: "nails", workModel: "home" });

  const businessId: string = business.body.id;

  if (options.withSettings !== false) {
    await request(app)
      .put(`/api/businesses/${businessId}/settings`)
      .set("authorization", `Bearer ${token}`)
      .send({
        desiredMonthlyWithdrawalCents: 420_000,
        productiveHoursPerMonth: 150,
        estimatedAppointmentsPerMonth: 60,
        fixedCostAllocationMethod: "PRODUCTIVE_HOUR",
        roundingStrategy: "NONE",
      });
  }

  return {
    app,
    deps,
    userId,
    token,
    businessId,
    /** Requisição já autenticada; passe outro token para agir como outra conta. */
    as: (sessionToken: string = token) => ({
      get: (path: string) => request(app).get(path).set("authorization", `Bearer ${sessionToken}`),
      post: (path: string) => request(app).post(path).set("authorization", `Bearer ${sessionToken}`),
      patch: (path: string) => request(app).patch(path).set("authorization", `Bearer ${sessionToken}`),
      put: (path: string) => request(app).put(path).set("authorization", `Bearer ${sessionToken}`),
      delete: (path: string) => request(app).delete(path).set("authorization", `Bearer ${sessionToken}`),
    }),
  };
}

/** Segunda conta, para os testes de isolamento entre negócios. */
export async function createOtherUser(app: ReturnType<typeof createApp>) {
  const session = await request(app)
    .post("/api/users")
    .send({ name: "Intrusa", email: "intrusa@exemplo.com", password: SENHA_DE_TESTE });

  const token: string = session.body.token;

  const business = await request(app)
    .post("/api/businesses")
    .set("authorization", `Bearer ${token}`)
    .send({ primaryCategory: "lashes", workModel: "own_salon" });

  return { userId: session.body.user.id as string, token, businessId: business.body.id as string };
}
