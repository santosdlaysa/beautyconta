/**
 * Contrato da agenda pública.
 *
 * A tela depende deste arquivo e de nenhum detalhe de HTTP: quem sabe traduzir
 * status code em causa é o adaptador em `infrastructure/booking`. Sem essa
 * fronteira, cada `if (response.status === 409)` acabaria espalhado pelo
 * componente, e o tratamento do horário perdido — que é o caso mais importante
 * desta página — ficaria escondido no meio da marcação.
 *
 * Os nomes dos campos são os da API de propósito: a resposta chega assim e
 * renomear no caminho só criaria um dicionário a mais para manter.
 */

export type PublicService = {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  priceCents: number;
};

export type BookingPage = {
  businessName: string | null;
  segment: string;
  timezone: string;
  services: PublicService[];
};

export type DayAvailability = {
  /** Data no formato AAAA-MM-DD. */
  date: string;
  /** Horários no relógio do negócio, como `09:30`. Lista vazia é dia sem vaga. */
  slots: string[];
};

export type BookingRequest = {
  serviceId: string;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  notes?: string;
};

export type BookingConfirmation = {
  /** Instante em UTC; a tela formata no relógio do negócio. */
  startsAt: string;
  durationMinutes: number;
  clientName: string;
};

/**
 * Causas que a página trata de forma diferente. São os códigos que a própria
 * API devolve no campo `error`, e não uma tradução paralela — assim o mapa
 * entre as duas pontas cabe na cabeça de quem lê os dois lados.
 *
 * - `not_found`: link inválido **ou** agenda desligada. A API não distingue de
 *   propósito, e a página também não pode distinguir.
 * - `conflict`: o horário foi ocupado entre ver a lista e confirmar.
 * - `invalid_input`: dado recusado; `field` diz qual.
 * - `too_many_requests`: teto de requisição.
 * - `unavailable`: rede fora, API fora ou resposta que não dá para entender.
 */
export type BookingErrorCode =
  | "not_found"
  | "conflict"
  | "invalid_input"
  | "too_many_requests"
  | "unavailable";

/**
 * A mensagem é escrita para a cliente e chega à tela como está — inclusive a
 * que vem da API, que já é redigida em português e sem jargão.
 */
export class BookingError extends Error {
  constructor(
    readonly code: BookingErrorCode,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export interface BookingGateway {
  page(slug: string, signal?: AbortSignal): Promise<BookingPage>;
  slots(
    slug: string,
    serviceId: string,
    date: string,
    signal?: AbortSignal,
  ): Promise<DayAvailability>;
  book(slug: string, request: BookingRequest, signal?: AbortSignal): Promise<BookingConfirmation>;
}
