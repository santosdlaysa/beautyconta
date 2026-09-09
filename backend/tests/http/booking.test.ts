import request from "supertest";
import { describe, expect, it } from "vitest";
import { setupApi } from "../support/api";

/**
 * Agenda pública: a cliente abre o link, escolhe horário e marca, sem conta.
 *
 * Os testes olham pelos olhos de quem tem só o link — é o que a internet
 * inteira teria se o endereço vazasse.
 */
async function agendaAberta() {
  const setup = await setupApi();
  const { app, as, businessId } = setup;

  // Expediente de quinta-feira, das 9h às 12h.
  await as().put(`/api/businesses/${businessId}/hours`).send({
    items: [{ weekday: 4, startMinute: 9 * 60, endMinute: 12 * 60 }],
  });

  const servico = await as().post(`/api/businesses/${businessId}/services`).send({
    name: "Alongamento",
    category: "extension",
    durationMinutes: 60,
    desiredMarginPercent: 30,
    currentPriceCents: 15_000,
  });

  const link = await as().post(`/api/businesses/${businessId}/booking-link`).send({});
  const token: string = link.body.bookingToken;

  /** Próxima quinta-feira, para nunca cair no passado. */
  const proximaQuinta = () => {
    const data = new Date();
    data.setDate(data.getDate() + ((4 - data.getDay() + 7) % 7 || 7));
    return data.toISOString().slice(0, 10);
  };

  return { ...setup, app, token, serviceId: servico.body.id as string, data: proximaQuinta() };
}

describe("agenda pública", () => {
  it("mostra o negócio e os serviços para quem tem o link", async () => {
    const { app, token } = await agendaAberta();

    const { status, body } = await request(app).get(`/api/booking/${token}`);

    expect(status).toBe(200);
    expect(body.businessName).toBe("Estúdio Marina");
    expect(body.services).toHaveLength(1);
    expect(body.services[0]).toMatchObject({ name: "Alongamento", durationMinutes: 60 });
  });

  it("não expõe nada do negócio por dentro", async () => {
    const { app, token } = await agendaAberta();

    const { body } = await request(app).get(`/api/booking/${token}`);
    const texto = JSON.stringify(body);

    // A página é aberta: custo, margem e identificador interno não saem daqui.
    expect(texto).not.toContain("marina@exemplo.com");
    expect(texto).not.toMatch(/margin|desiredMargin|cost|Cost/);
    expect(body.services[0].id).toBeDefined(); // o id do serviço é necessário para marcar
    expect(body.ownerUserId).toBeUndefined();
  });

  it("oferece horários livres do dia", async () => {
    const { app, token, serviceId, data } = await agendaAberta();

    const { status, body } = await request(app)
      .get(`/api/booking/${token}/slots`)
      .query({ serviceId, date: data });

    expect(status).toBe(200);
    expect(body.slots).toContain("09:00");
    expect(body.slots).toContain("11:00");
    // Uma hora de serviço não cabe começando às 11:15 num expediente até 12:00.
    expect(body.slots).not.toContain("11:15");
  });

  it("não oferece horário em dia sem expediente", async () => {
    const { app, token, serviceId, data } = await agendaAberta();

    // O dia seguinte à quinta não tem expediente cadastrado.
    const sexta = new Date(`${data}T12:00:00Z`);
    sexta.setDate(sexta.getDate() + 1);

    const { body } = await request(app)
      .get(`/api/booking/${token}/slots`)
      .query({ serviceId, date: sexta.toISOString().slice(0, 10) });

    expect(body.slots).toEqual([]);
  });

  it("marca o atendimento e ele aparece na agenda da profissional", async () => {
    const { app, as, businessId, token, serviceId, data } = await agendaAberta();

    const { status, body } = await request(app)
      .post(`/api/booking/${token}/appointments`)
      .send({
        serviceId,
        date: data,
        time: "10:00",
        clientName: "Ana Cliente",
        clientPhone: "95 99999-0000",
      });

    expect(status).toBe(201);
    expect(body.clientName).toBe("Ana Cliente");

    const agenda = await as()
      .get(`/api/businesses/${businessId}/appointments`)
      .query({ from: data, to: data });

    expect(agenda.body.items).toHaveLength(1);
    expect(agenda.body.items[0]).toMatchObject({
      clientName: "Ana Cliente",
      source: "ONLINE",
      status: "SCHEDULED",
    });
  });

  it("tira da lista o horário que acabou de ser ocupado", async () => {
    const { app, token, serviceId, data } = await agendaAberta();

    await request(app).post(`/api/booking/${token}/appointments`).send({
      serviceId, date: data, time: "10:00", clientName: "Ana", clientPhone: "95 99999-0000",
    });

    const { body } = await request(app)
      .get(`/api/booking/${token}/slots`)
      .query({ serviceId, date: data });

    expect(body.slots).not.toContain("10:00");
    expect(body.slots).not.toContain("09:30"); // terminaria dentro do ocupado
    expect(body.slots).toContain("09:00");
  });

  it("recusa a segunda cliente que escolher o mesmo horário", async () => {
    const { app, token, serviceId, data } = await agendaAberta();
    const marcar = (nome: string) =>
      request(app).post(`/api/booking/${token}/appointments`).send({
        serviceId, date: data, time: "10:00", clientName: nome, clientPhone: "95 99999-0000",
      });

    const primeira = await marcar("Ana");
    const segunda = await marcar("Bia");

    expect(primeira.status).toBe(201);
    expect(segunda.status).toBe(409);
    expect(segunda.body.message).toMatch(/escolha outro/i);
  });

  it("recusa data que já passou", async () => {
    const { app, token, serviceId } = await agendaAberta();

    const { status, body } = await request(app).post(`/api/booking/${token}/appointments`).send({
      serviceId, date: "2020-01-02", time: "10:00", clientName: "Ana", clientPhone: "95 99999-0000",
    });

    expect(status).toBe(422);
    expect(body.field).toBe("date");
  });

  it("recusa horário fora do expediente", async () => {
    const { app, token, serviceId, data } = await agendaAberta();

    const { status } = await request(app).post(`/api/booking/${token}/appointments`).send({
      serviceId, date: data, time: "20:00", clientName: "Ana", clientPhone: "95 99999-0000",
    });

    expect(status).toBe(409);
  });

  it("exige telefone: é a única forma de retomar contato", async () => {
    const { app, token, serviceId, data } = await agendaAberta();

    const { status, body } = await request(app).post(`/api/booking/${token}/appointments`).send({
      serviceId, date: data, time: "10:00", clientName: "Ana",
    });

    expect(status).toBe(422);
    expect(body.field).toBe("clientPhone");
  });
});

describe("o link como barreira", () => {
  it("dá a mesma resposta para link inventado e agenda fechada", async () => {
    const { app, as, businessId, token } = await agendaAberta();

    const inventado = await request(app).get(`/api/booking/${"z".repeat(32)}`);
    expect(inventado.status).toBe(404);

    await as().delete(`/api/businesses/${businessId}/booking-link`);
    const desligado = await request(app).get(`/api/booking/${token}`);

    // Quem tenta adivinhar não distingue "não existe" de "existe e está fechada".
    expect(desligado.status).toBe(404);
    expect(desligado.body).toEqual(inventado.body);
  });

  it("token curto também dá 404, e não erro de validação", async () => {
    const { app } = await agendaAberta();

    // Exigir tamanho mínimo faria "malformado" e "desconhecido" darem respostas
    // diferentes — a peneira que o 404 único existe para fechar.
    for (const suspeito of ["x", "abc", "z".repeat(15)]) {
      const { status } = await request(app).get(`/api/booking/${suspeito}`);
      expect(status).toBe(404);
    }
  });

  it("diz 'não encontrada', porque agenda é palavra feminina", async () => {
    const { app } = await agendaAberta();

    const { body } = await request(app).get(`/api/booking/${"z".repeat(32)}`);
    expect(body.message).toBe("Agenda não encontrada.");
  });

  it("trocar o link derruba o endereço antigo na hora", async () => {
    const { app, as, businessId, token } = await agendaAberta();

    const novo = await as().post(`/api/businesses/${businessId}/booking-link/regenerate`).send({});

    expect(novo.body.bookingToken).not.toBe(token);
    expect((await request(app).get(`/api/booking/${token}`)).status).toBe(404);
    expect((await request(app).get(`/api/booking/${novo.body.bookingToken}`)).status).toBe(200);
  });

  it("não deixa marcar em negócio de outra pessoa pelo link errado", async () => {
    const { app, token, data } = await agendaAberta();
    const outra = await agendaAberta();

    // Serviço da segunda profissional, link da primeira.
    const { status } = await request(app).post(`/api/booking/${token}/appointments`).send({
      serviceId: outra.serviceId, date: data, time: "10:00",
      clientName: "Ana", clientPhone: "95 99999-0000",
    });

    expect(status).toBe(404);
  });
});

describe("o link visto pela dona", () => {
  it("aparece nos dados do negócio, para o aplicativo saber que existe", async () => {
    const { as, businessId, token } = await agendaAberta();

    const { body } = await as().get(`/api/businesses/${businessId}`);

    // Sem isto, o aplicativo precisaria guardar uma cópia no aparelho — que
    // some quando ela troca de celular.
    expect(body.bookingToken).toBe(token);
  });

  it("some quando a agenda é desligada", async () => {
    const { as, businessId } = await agendaAberta();

    await as().delete(`/api/businesses/${businessId}/booking-link`);
    const { body } = await as().get(`/api/businesses/${businessId}`);

    expect(body.bookingToken).toBeNull();
  });

  it("não vaza para outra pessoa", async () => {
    const { app, as, businessId } = await agendaAberta();
    const intrusa = await (await import("../support/api")).createOtherUser(app);

    const { status } = await as(intrusa.token).get(`/api/businesses/${businessId}`);
    expect(status).toBe(403);
  });
});

describe("telefone no atendimento marcado pela profissional", () => {
  it("é gravado quando informado", async () => {
    const { as, businessId } = await agendaAberta();

    const criado = await as().post(`/api/businesses/${businessId}/appointments`).send({
      clientName: "Ana",
      clientPhone: "95 98888-0000",
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      durationMinutes: 60,
      priceCents: 15_000,
    });

    // Antes o campo era descartado em silêncio por não existir no esquema.
    expect(criado.status).toBe(201);
    expect(criado.body.clientPhone).toBe("95 98888-0000");
    expect(criado.body.source).toBe("MANUAL");
  });

  it("continua opcional: ela já sabe como falar com a cliente", async () => {
    const { as, businessId } = await agendaAberta();

    const criado = await as().post(`/api/businesses/${businessId}/appointments`).send({
      clientName: "Ana",
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      durationMinutes: 60,
      priceCents: 15_000,
    });

    expect(criado.status).toBe(201);
    expect(criado.body.clientPhone).toBeNull();
  });
});

describe("expediente", () => {
  it("recusa faixas do mesmo dia que se sobrepõem", async () => {
    const { as, businessId } = await setupApi();

    const { status, body } = await as().put(`/api/businesses/${businessId}/hours`).send({
      items: [
        { weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 },
        { weekday: 1, startMinute: 11 * 60, endMinute: 15 * 60 },
      ],
    });

    expect(status).toBe(422);
    expect(body.message).toMatch(/sobrep/i);
  });

  it("recusa fim antes do início", async () => {
    const { as, businessId } = await setupApi();

    const { status } = await as().put(`/api/businesses/${businessId}/hours`).send({
      items: [{ weekday: 1, startMinute: 15 * 60, endMinute: 9 * 60 }],
    });

    expect(status).toBe(422);
  });

  it("substitui a semana inteira a cada gravação", async () => {
    const { as, businessId } = await setupApi();
    const url = `/api/businesses/${businessId}/hours`;

    await as().put(url).send({ items: [{ weekday: 1, startMinute: 540, endMinute: 720 }] });
    await as().put(url).send({ items: [{ weekday: 2, startMinute: 600, endMinute: 780 }] });

    const { body } = await as().get(url);

    expect(body.items).toEqual([{ weekday: 2, start: "10:00", end: "13:00" }]);
  });
});
