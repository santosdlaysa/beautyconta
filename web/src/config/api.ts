/**
 * Endereço da API do BeautyConta, usado pela página pública de agendamento.
 *
 * O recuo silencioso para `localhost` segue a mesma assimetria de
 * `config/site.ts`, e pelo mesmo motivo: em desenvolvimento ele economiza
 * configuração, em produção ele seria pior que um erro visível. A página de
 * agendamento chega à cliente por um link no WhatsApp; se o endereço apontar
 * para `localhost`, ela vê uma tela quebrada e a profissional só descobre
 * quando alguém reclamar. Uma construção que falha com mensagem clara custa
 * minutos; um link de agendamento morto custa cliente.
 */

const DEVELOPMENT_FALLBACK = "http://localhost:3333";

export const MISSING_API_URL_MESSAGE =
  "NEXT_PUBLIC_API_URL não está definida. Defina o endereço da API, sem barra no final, antes de construir para produção. Veja web/.env.example.";

export const INVALID_API_URL_MESSAGE =
  "NEXT_PUBLIC_API_URL precisa ser um endereço absoluto começando por http:// ou https://, sem barra no final. Veja web/.env.example.";

/**
 * Recebe a variável e o ambiente por parâmetro para que o comportamento em
 * produção possa ser verificado em teste sem depender do ambiente de quem roda.
 */
export function resolveApiUrl(rawUrl: string | undefined, nodeEnv: string | undefined): string {
  const configured = rawUrl?.trim();

  if (!configured) {
    if (nodeEnv === "production") throw new Error(MISSING_API_URL_MESSAGE);
    return DEVELOPMENT_FALLBACK;
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error(INVALID_API_URL_MESSAGE);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(INVALID_API_URL_MESSAGE);
  }

  // A barra final duplicaria a barra dos caminhos montados a partir daqui.
  return configured.replace(/\/+$/, "");
}

export const API_URL = resolveApiUrl(process.env.NEXT_PUBLIC_API_URL, process.env.NODE_ENV);
