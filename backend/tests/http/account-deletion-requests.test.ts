import request from "supertest";
import { describe, expect, it } from "vitest";
import { SEGREDO_DO_PAINEL } from "../support/in-memory";
import { SENHA_DE_TESTE, setupApi } from "../support/api";

/**
 * Pedido público de exclusão de conta.
 *
 * Existe para quem **não consegue entrar** — desinstalou, esqueceu a senha,
 * trocou de aparelho. Apple e Google exigem este caminho em todo aplicativo que
 * cria conta: sem ele a submissão é recusada.
 */

type Cenario = Awaited<ReturnType<typeof setupApi>>;

const pedir = (setup: Cenario, body: Record<string, unknown>) =>
  request(setup.app).post("/api/account-deletion-requests").send(body);

describe("pedido de exclusão vindo do site", () => {
  it("aceita sem exigir conta, que é o ponto", async () => {
    const setup = await setupApi();

    const { status, body } = await pedir(setup, {
      email: "quem.perdeu.a.senha@exemplo.com",
      note: "Não consigo mais entrar no aplicativo.",
    });

    expect(status).toBe(202);
    expect(body.message).toMatch(/confirmar sua identidade/i);
    expect(setup.deps.accountDeletionRequests.items).toHaveLength(1);
  });

  it("responde igual para e-mail que existe e para e-mail que não existe", async () => {
    const setup = await setupApi();

    // A conta da suíte existe; a outra, não.
    const existente = await pedir(setup, { email: "marina@exemplo.com" });
    const inventado = await pedir(setup, { email: "ninguem@exemplo.com" });

    // Responder diferente transformaria esta rota num detector de contas:
    // bastaria enviar e-mails e observar a diferença.
    expect(existente.status).toBe(inventado.status);
    expect(existente.body).toStrictEqual(inventado.body);
  });

  it("guarda o e-mail normalizado, para bater com o cadastro depois", async () => {
    const setup = await setupApi();

    await pedir(setup, { email: "  Marina@Exemplo.COM  " });

    expect(setup.deps.accountDeletionRequests.items[0]?.email).toBe("marina@exemplo.com");
  });

  it("avisa quem atende, senão o pedido fica esperando no banco", async () => {
    const setup = await setupApi();

    await pedir(setup, { email: "alguem@exemplo.com", note: "Quero sair" });

    const [aviso] = setup.deps.notifier.ofKind("account_deletion_request");

    // Há prazo legal para responder: sem o aviso, ninguém fica sabendo.
    expect(aviso).toBeDefined();
    expect(aviso).toMatchObject({ email: "alguem@exemplo.com", note: "Quero sair" });
  });

  it("recusa e-mail malformado", async () => {
    const setup = await setupApi();

    const { status } = await pedir(setup, { email: "isso-nao-e-email" });

    expect(status).toBe(422);
  });

  it("aceita pedido sem justificativa", async () => {
    const setup = await setupApi();

    const { status } = await pedir(setup, { email: "curta@exemplo.com" });

    expect(status).toBe(202);
    expect(setup.deps.accountDeletionRequests.items[0]?.note).toBeNull();
  });
});

describe("tratamento dos pedidos", () => {
  async function comPedido() {
    const setup = await setupApi();
    await pedir(setup, { email: "sair@exemplo.com", note: "Por favor apaguem tudo" });
    return setup;
  }

  it("a lista é restrita ao painel", async () => {
    const setup = await comPedido();

    // A rota de criação é pública; a de leitura, não. Sem isso, qualquer pessoa
    // leria os e-mails de quem pediu para sair.
    const semCredencial = await request(setup.app).get("/api/admin/account-deletion-requests");
    expect(semCredencial.status).toBe(401);

    const comCredencial = await request(setup.app)
      .get("/api/admin/account-deletion-requests")
      .set("x-admin-secret", SEGREDO_DO_PAINEL);

    expect(comCredencial.status).toBe(200);
    expect(comCredencial.body.items).toHaveLength(1);
    expect(comCredencial.body.items[0].status).toBe("pending");
  });

  it("marcar como tratado registra quando, sem apagar a conta sozinho", async () => {
    const setup = await comPedido();
    const { id } = setup.deps.accountDeletionRequests.items[0]!;

    const { status, body } = await request(setup.app)
      .patch(`/api/admin/account-deletion-requests/${id}`)
      .set("x-admin-secret", SEGREDO_DO_PAINEL)
      .send({ status: "done" });

    expect(status).toBe(200);
    expect(body.status).toBe("done");
    expect(body.handledAt).not.toBeNull();

    // Apagar exige confirmar que quem pediu é a dona do e-mail, e essa
    // conferência é humana. O painel registra o desfecho, não executa a
    // exclusão.
    const conta = await setup.as().get("/api/users/me");
    expect(conta.status).toBe(200);
  });

  it("filtra por situação, para separar o que falta tratar", async () => {
    const setup = await comPedido();
    await pedir(setup, { email: "outra@exemplo.com" });

    const { id } = setup.deps.accountDeletionRequests.items[0]!;
    await request(setup.app)
      .patch(`/api/admin/account-deletion-requests/${id}`)
      .set("x-admin-secret", SEGREDO_DO_PAINEL)
      .send({ status: "done" });

    const pendentes = await request(setup.app)
      .get("/api/admin/account-deletion-requests?status=pending")
      .set("x-admin-secret", SEGREDO_DO_PAINEL);

    expect(pendentes.body.items).toHaveLength(1);
    expect(pendentes.body.items[0].email).toBe("outra@exemplo.com");
  });

  it("recusa situação que não existe", async () => {
    const setup = await comPedido();
    const { id } = setup.deps.accountDeletionRequests.items[0]!;

    const { status } = await request(setup.app)
      .patch(`/api/admin/account-deletion-requests/${id}`)
      .set("x-admin-secret", SEGREDO_DO_PAINEL)
      .send({ status: "apagado-por-engano" });

    expect(status).toBe(422);
  });
});

describe("quem consegue entrar apaga sozinha", () => {
  it("a exclusão pelo aplicativo continua imediata, sem fila", async () => {
    const { as, app } = await setupApi();

    const apagou = await as().delete("/api/users/me");
    expect(apagou.status).toBe(204);

    // Sem pedido nenhum na fila: quem está dentro não precisa esperar ninguém.
    const fila = await request(app)
      .get("/api/admin/account-deletion-requests")
      .set("x-admin-secret", SEGREDO_DO_PAINEL);

    expect(fila.body.items).toHaveLength(0);
    void SENHA_DE_TESTE;
  });
});
