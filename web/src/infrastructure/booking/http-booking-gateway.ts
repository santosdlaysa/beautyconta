import {
  BookingError,
  type BookingConfirmation,
  type BookingErrorCode,
  type BookingGateway,
  type BookingPage,
  type DayAvailability,
  type PublicService,
} from "@/application/ports/booking";

/**
 * Adaptador HTTP das três rotas abertas da agenda.
 *
 * A tradução de status code em causa mora aqui inteira, e é a parte do arquivo
 * que merece atenção:
 *
 * - **404 nunca repassa a mensagem da API.** Link inválido e agenda desligada
 *   respondem igual de propósito, para que o endereço não sirva de sonda. Se a
 *   página exibisse o texto do servidor, uma mudança de mensagem lá viraria
 *   sem querer a distinção que o backend evita.
 * - **422 no dado da página é tratado como 404.** A única entrada dessa rota é
 *   o slug, então "slug malformado" e "slug desconhecido" são a mesma coisa
 *   para quem abriu o link — e devolver 422 ali distinguiria os dois casos.
 * - **409 repassa a mensagem da API**, que já explica à cliente que o horário
 *   foi ocupado e o que fazer.
 */

const NOT_FOUND_MESSAGE =
  "Este link de agendamento não está disponível. Peça um link novo para a profissional, por favor.";

const UNAVAILABLE_MESSAGE =
  "Não conseguimos falar com a agenda agora. Confira sua conexão e tente de novo.";

const DEFAULT_MESSAGE: Record<BookingErrorCode, string> = {
  not_found: NOT_FOUND_MESSAGE,
  conflict: "Esse horário não está mais disponível. Escolha outro na lista, por favor.",
  invalid_input: "Confira os dados informados.",
  too_many_requests: "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.",
  unavailable: UNAVAILABLE_MESSAGE,
};

type ApiErrorBody = { message?: unknown; field?: unknown };

export function createHttpBookingGateway(
  baseUrl: string,
  /**
   * Envolvido em função em vez de recebido como referência: `fetch` do
   * navegador precisa do `window` como receptor e estoura "Illegal invocation"
   * quando é chamado solto.
   */
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): BookingGateway {
  const url = (path: string) => `${baseUrl}/api/booking${path}`;

  async function request<T>(input: string, init: RequestInit, notFoundIsInvalid = false): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(input, init);
    } catch (error) {
      // Cancelamento é fluxo normal — a cliente trocou de dia antes de a lista
      // anterior chegar — e não pode virar mensagem de erro na tela.
      if (isAbort(error)) throw error;
      throw new BookingError("unavailable", UNAVAILABLE_MESSAGE);
    }

    if (response.ok) return (await readJson(response)) as T;

    const body = ((await readJson(response)) ?? {}) as ApiErrorBody;
    const code = codeOf(response.status, notFoundIsInvalid);
    const field = typeof body.field === "string" ? body.field : undefined;

    throw new BookingError(code, messageOf(code, body.message), field);
  }

  return {
    async page(slug, signal) {
      const page = await request<unknown>(
        url(`/${encodeURIComponent(slug)}`),
        { signal, cache: "no-store", headers: { accept: "application/json" } },
        true,
      );
      return toBookingPage(page);
    },

    async slots(slug, serviceId, date, signal) {
      const query = new URLSearchParams({ serviceId, date });
      const availability = await request<unknown>(
        url(`/${encodeURIComponent(slug)}/slots?${query}`),
        { signal, cache: "no-store", headers: { accept: "application/json" } },
      );
      return toDayAvailability(availability, date);
    },

    async book(slug, booking, signal) {
      const confirmation = await request<unknown>(url(`/${encodeURIComponent(slug)}/appointments`), {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(booking),
      });
      return toConfirmation(confirmation);
    },
  };
}

function codeOf(status: number, notFoundIsInvalid: boolean): BookingErrorCode {
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "too_many_requests";
  if (status === 422) return notFoundIsInvalid ? "not_found" : "invalid_input";
  return "unavailable";
}

/** Mensagem da API só passa quando é dirigida à cliente e não vaza distinção. */
function messageOf(code: BookingErrorCode, message: unknown): string {
  if (code === "not_found" || code === "unavailable") return DEFAULT_MESSAGE[code];
  return typeof message === "string" && message.trim() ? message : DEFAULT_MESSAGE[code];
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    // Resposta sem corpo ou com HTML de proxy no lugar do JSON. Devolver nulo
    // deixa quem chamou decidir, em vez de derrubar com erro de sintaxe.
    return null;
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * A resposta é conferida antes de virar tela.
 *
 * Não é desconfiança da API: é que a alternativa a conferir aqui é a página
 * quebrar no meio da lista de serviços, com a cliente olhando, por causa de um
 * campo que mudou de forma.
 */
function toBookingPage(value: unknown): BookingPage {
  const page = asObject(value);
  const services = Array.isArray(page.services) ? page.services : invalid();

  return {
    businessName: typeof page.businessName === "string" ? page.businessName : null,
    segment: asString(page.segment),
    timezone: asString(page.timezone),
    services: services.map(toService),
  };
}

function toService(value: unknown): PublicService {
  const service = asObject(value);
  return {
    id: asString(service.id),
    name: asString(service.name),
    category: asString(service.category),
    durationMinutes: asNumber(service.durationMinutes),
    priceCents: asNumber(service.priceCents),
  };
}

function toDayAvailability(value: unknown, requested: string): DayAvailability {
  const availability = asObject(value);
  const slots = Array.isArray(availability.slots) ? availability.slots : invalid();

  return {
    date: typeof availability.date === "string" ? availability.date : requested,
    slots: slots.map(asString),
  };
}

function toConfirmation(value: unknown): BookingConfirmation {
  const confirmation = asObject(value);
  return {
    startsAt: asString(confirmation.startsAt),
    durationMinutes: asNumber(confirmation.durationMinutes),
    clientName: asString(confirmation.clientName),
  };
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (typeof value !== "string") invalid();
  return value as string;
}

function asNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) invalid();
  return value as number;
}

function invalid(): never {
  throw new BookingError("unavailable", UNAVAILABLE_MESSAGE);
}
