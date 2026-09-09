import { describe, expect, it, vi } from "vitest";
import { BookingError } from "../src/application/ports/booking";
import { createHttpBookingGateway } from "../src/infrastructure/booking/http-booking-gateway";

/**
 * O que este teste protege é o tratamento de erro da página de agendamento, que
 * é a parte que a cliente encontra no pior momento: com o telefone na mão, o
 * nome já digitado e o horário perdido.
 *
 * Dois pontos valem mais que os outros:
 *
 * - o 404 nunca deixa escapar a diferença entre link inválido e agenda
 *   desligada, que a API esconde de propósito;
 * - o 409 chega à tela como conflito e com a mensagem da API, porque é ela que
 *   diz à cliente o que fazer em seguida.
 */

const TOKEN = "abcdefghijklmnopqrstuvwx";
const BASE = "https://api.exemplo.test";

function gatewayRespondendo(status: number, body: unknown, capture?: (input: string, init?: RequestInit) => void) {
  const fetchStub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    capture?.(String(input), init);
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });

  return { gateway: createHttpBookingGateway(BASE, fetchStub as unknown as typeof fetch), fetchStub };
}

const PAGINA = {
  businessName: "Estúdio Marina",
  segment: "nails",
  timezone: "America/Sao_Paulo",
  services: [
    { id: "11111111-1111-4111-8111-111111111111", name: "Alongamento", category: "extension", durationMinutes: 60, priceCents: 15000 },
  ],
};

const PEDIDO = {
  serviceId: "11111111-1111-4111-8111-111111111111",
  date: "2026-09-17",
  time: "10:00",
  clientName: "Ana",
  clientPhone: "95 99999-0000",
};

describe("dados da página", () => {
  it("monta o endereço das três rotas abertas", async () => {
    const chamadas: string[] = [];
    const { gateway } = gatewayRespondendo(200, PAGINA, (input) => chamadas.push(input));

    await gateway.page(TOKEN);
    expect(chamadas[0]).toBe(`${BASE}/api/booking/${TOKEN}`);
  });

  it("devolve o negócio, o fuso e os serviços", async () => {
    const { gateway } = gatewayRespondendo(200, PAGINA);
    await expect(gateway.page(TOKEN)).resolves.toStrictEqual(PAGINA);
  });

  it("recusa resposta com forma inesperada em vez de quebrar no meio da tela", async () => {
    const { gateway } = gatewayRespondendo(200, { businessName: "Estúdio Marina" });
    await expect(gateway.page(TOKEN)).rejects.toMatchObject({ code: "unavailable" });
  });
});

describe("404 da agenda", () => {
  it("responde igual para link inválido e agenda desligada", async () => {
    const { gateway } = gatewayRespondendo(404, { error: "not_found", message: "Agenda não encontrado." });

    const erro = await gateway.page(TOKEN).catch((error: unknown) => error);

    expect(erro).toBeInstanceOf(BookingError);
    expect((erro as BookingError).code).toBe("not_found");
    // A mensagem do servidor não passa: se um dia ela distinguir os dois casos,
    // a página não vira a peneira que a API evitou ser.
    expect((erro as BookingError).message).not.toContain("Agenda não encontrado");
    expect((erro as BookingError).message).toContain("não está disponível");
  });

  it("trata token malformado como link indisponível, e não como dado inválido", async () => {
    // O token é a única entrada dessa rota: distinguir "curto demais" de
    // "desconhecido" contaria à sonda que o formato dela chegou perto.
    const { gateway } = gatewayRespondendo(422, { error: "invalid_input", message: "Confira os dados informados.", field: "token" });

    await expect(gateway.page("curto")).rejects.toMatchObject({ code: "not_found" });
  });

  it("mantém `not_found` nas outras rotas quando a agenda é desligada no meio do caminho", async () => {
    const { gateway } = gatewayRespondendo(404, { error: "not_found", message: "Agenda não encontrado." });

    await expect(gateway.slots(TOKEN, PEDIDO.serviceId, PEDIDO.date)).rejects.toMatchObject({ code: "not_found" });
    await expect(gateway.book(TOKEN, PEDIDO)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("horários livres", () => {
  it("leva serviço e data na consulta", async () => {
    const chamadas: string[] = [];
    const { gateway } = gatewayRespondendo(200, { date: PEDIDO.date, slots: ["09:00"] }, (input) => chamadas.push(input));

    await gateway.slots(TOKEN, PEDIDO.serviceId, PEDIDO.date);

    expect(chamadas[0]).toBe(`${BASE}/api/booking/${TOKEN}/slots?serviceId=${PEDIDO.serviceId}&date=${PEDIDO.date}`);
  });

  it("dia sem vaga é lista vazia, e não erro", async () => {
    const { gateway } = gatewayRespondendo(200, { date: PEDIDO.date, slots: [] });

    await expect(gateway.slots(TOKEN, PEDIDO.serviceId, PEDIDO.date)).resolves.toStrictEqual({
      date: PEDIDO.date,
      slots: [],
    });
  });
});

describe("agendamento", () => {
  it("envia o pedido como JSON no método POST", async () => {
    let recebido: RequestInit | undefined;
    const { gateway } = gatewayRespondendo(
      201,
      { startsAt: "2026-09-17T13:00:00.000Z", durationMinutes: 60, clientName: "Ana" },
      (_input, init) => void (recebido = init),
    );

    const confirmacao = await gateway.book(TOKEN, { ...PEDIDO, notes: "Chego 10 minutos antes." });

    expect(recebido?.method).toBe("POST");
    expect(JSON.parse(String(recebido?.body))).toStrictEqual({ ...PEDIDO, notes: "Chego 10 minutos antes." });
    expect(confirmacao).toStrictEqual({
      startsAt: "2026-09-17T13:00:00.000Z",
      durationMinutes: 60,
      clientName: "Ana",
    });
  });

  it("traz o 409 como conflito, com a mensagem que a API escreveu para a cliente", async () => {
    const mensagem = "Esse horário acabou de ser ocupado. Escolha outro na lista, por favor.";
    const { gateway } = gatewayRespondendo(409, { error: "conflict", message: mensagem });

    const erro = await gateway.book(TOKEN, PEDIDO).catch((error: unknown) => error);

    expect((erro as BookingError).code).toBe("conflict");
    expect((erro as BookingError).message).toBe(mensagem);
  });

  it("traz o 422 com o campo culpado, para a tela destacar o que corrigir", async () => {
    const { gateway } = gatewayRespondendo(422, {
      error: "domain_error",
      message: "Use o formato HH:MM, como 09:30.",
      field: "time",
    });

    const erro = await gateway.book(TOKEN, PEDIDO).catch((error: unknown) => error);

    expect((erro as BookingError).code).toBe("invalid_input");
    expect((erro as BookingError).field).toBe("time");
    expect((erro as BookingError).message).toBe("Use o formato HH:MM, como 09:30.");
  });

  it("traz o 429 como teto de requisição", async () => {
    const { gateway } = gatewayRespondendo(429, {
      error: "too_many_requests",
      message: "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.",
    });

    await expect(gateway.book(TOKEN, PEDIDO)).rejects.toMatchObject({ code: "too_many_requests" });
  });

  it("trata falha de rede e erro do servidor como indisponibilidade, não como recusa", async () => {
    const semRede = createHttpBookingGateway(BASE, async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(semRede.book(TOKEN, PEDIDO)).rejects.toMatchObject({ code: "unavailable" });

    const { gateway } = gatewayRespondendo(500, { error: "internal_error", message: "erro interno" });
    await expect(gateway.book(TOKEN, PEDIDO)).rejects.toMatchObject({ code: "unavailable" });
  });

  it("não confunde resposta sem JSON com erro de programação", async () => {
    const comHtml = createHttpBookingGateway(
      BASE,
      async () => new Response("<html>502</html>", { status: 502, headers: { "content-type": "text/html" } }),
    );

    await expect(comHtml.page(TOKEN)).rejects.toMatchObject({ code: "unavailable" });
  });

  it("deixa o cancelamento passar: trocar de dia antes da resposta não é erro", async () => {
    const controller = new AbortController();
    const cancelado = createHttpBookingGateway(BASE, async () => {
      const abort = new Error("cancelado");
      abort.name = "AbortError";
      throw abort;
    });

    controller.abort();
    await expect(
      cancelado.slots(TOKEN, PEDIDO.serviceId, PEDIDO.date, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
