import { describe, expect, it } from "vitest";
import { createOtherUser, setupApi } from "../support/api";

/** Hoje às HH:MM no fuso local, que é como o aplicativo envia. */
function hoje(hora: number, minuto = 0): string {
  const date = new Date();
  date.setHours(hora, minuto, 0, 0);
  return date.toISOString();
}

const dia = (): string => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

async function agenda() {
  const api = await setupApi();
  const base = `/api/businesses/${api.businessId}/appointments`;

  const marcar = (input: Record<string, unknown>) => api.as().post(base).send(input);

  return { ...api, base, marcar };
}

describe("agenda do dia", () => {
  it("marca um atendimento e devolve o que falta receber", async () => {
    const { marcar } = await agenda();

    const { status, body } = await marcar({
      clientName: "Mariana Souza",
      startsAt: hoje(9),
      durationMinutes: 120,
      priceCents: 17_143,
    });

    expect(status).toBe(201);
    expect(body.paidCents).toBe(0);
    expect(body.pendingCents).toBe(17_143);
    expect(body.status).toBe("SCHEDULED");
  });

  it("lista apenas os atendimentos do dia pedido", async () => {
    const { as, base, marcar } = await agenda();
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    ontem.setHours(10, 0, 0, 0);

    await marcar({ clientName: "Hoje", startsAt: hoje(9), durationMinutes: 60, priceCents: 10_000 });
    await marcar({ clientName: "Ontem", startsAt: ontem.toISOString(), durationMinutes: 60, priceCents: 10_000 });

    const { body } = await as().get(`${base}?day=${dia()}`);

    expect(body.items).toHaveLength(1);
    expect(body.items[0].clientName).toBe("Hoje");
  });

  it("quita o combinado com um toque", async () => {
    const { as, base, marcar } = await agenda();
    const marcado = await marcar({
      clientName: "Ana Beatriz",
      startsAt: hoje(11),
      durationMinutes: 60,
      priceCents: 9_500,
    });

    const { status, body } = await as().post(`${base}/${marcado.body.id}/settle`).send({});

    expect(status).toBe(200);
    expect(body.paidCents).toBe(9_500);
    expect(body.pendingCents).toBe(0);
    expect(body.status).toBe("DONE");
    expect(body.paidAt).not.toBeNull();
  });

  it("aceita pagamento parcial e mantém o restante em aberto", async () => {
    const { as, base, marcar } = await agenda();
    const marcado = await marcar({
      clientName: "Júlia",
      startsAt: hoje(14),
      durationMinutes: 60,
      priceCents: 10_000,
    });

    const { body } = await as().post(`${base}/${marcado.body.id}/settle`).send({ paidCents: 4_000 });

    expect(body.paidCents).toBe(4_000);
    expect(body.pendingCents).toBe(6_000);
  });

  it("resume o dia separando o combinado do que entrou", async () => {
    const { as, base, marcar } = await agenda();

    const pago = await marcar({ clientName: "Paga", startsAt: hoje(9), durationMinutes: 120, priceCents: 17_000 });
    await marcar({ clientName: "A receber", startsAt: hoje(14), durationMinutes: 60, priceCents: 9_000 });
    await marcar({
      clientName: "Cancelada",
      startsAt: hoje(16),
      durationMinutes: 60,
      priceCents: 20_000,
      status: "CANCELED",
    });
    await as().post(`${base}/${pago.body.id}/settle`).send({});

    const { body } = await as().get(`${base}/summary?day=${dia()}`);

    // A cancelada não conta em lugar nenhum: não é atendimento nem recebível.
    expect(body.appointments).toBe(2);
    expect(body.expectedCents).toBe(26_000);
    expect(body.receivedCents).toBe(17_000);
    expect(body.pendingCents).toBe(9_000);
    expect(body.occupiedMinutes).toBe(180);
  });

  it("mantém o que já foi pago quando o atendimento é cancelado depois", async () => {
    const { as, base, marcar } = await agenda();
    const marcado = await marcar({
      clientName: "Sinal pago",
      startsAt: hoje(10),
      durationMinutes: 60,
      priceCents: 10_000,
    });
    await as().post(`${base}/${marcado.body.id}/settle`).send({ paidCents: 3_000 });
    await as().patch(`${base}/${marcado.body.id}`).send({ status: "CANCELED" });

    const { body } = await as().get(`${base}/summary?day=${dia()}`);

    expect(body.expectedCents).toBe(0);
    expect(body.receivedCents).toBe(3_000);
    expect(body.pendingCents).toBe(0);
  });

  it("recusa serviço de outro negócio na hora de marcar", async () => {
    const { app, as, base } = await agenda();
    const intrusa = await createOtherUser(app);
    const alheio = await as(intrusa.token)
      .post(`/api/businesses/${intrusa.businessId}/services`)
      .send({ name: "Serviço alheio", category: "extension", durationMinutes: 60, desiredMarginPercent: 30 });

    const { status } = await as().post(base).send({
      clientName: "Tentativa",
      serviceId: alheio.body.id,
      startsAt: hoje(15),
      durationMinutes: 60,
      priceCents: 10_000,
    });

    expect(status).toBe(404);
  });

  it("não deixa outra conta ler a agenda", async () => {
    const { app, as, base, marcar } = await agenda();
    await marcar({ clientName: "Minha cliente", startsAt: hoje(9), durationMinutes: 60, priceCents: 10_000 });
    const intrusa = await createOtherUser(app);

    const { status } = await as(intrusa.token).get(base);

    expect(status).toBe(403);
  });
});
