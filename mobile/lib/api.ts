import { NativeModules, Platform } from 'react-native';

/**
 * Acesso à API do BeautyConta.
 *
 * Uma única porta de saída do aplicativo: toda tela conversa com o servidor por
 * aqui, e por isso o token da sessão, o formato do erro e a conversão de
 * centavos ficam resolvidos em um lugar só.
 */

/** Porta em que o `backend/` sobe em desenvolvimento. */
const DEV_PORT = 3333;

/**
 * Endereço do computador que serve o pacote, visto pelo aparelho.
 *
 * No Expo Go em celular físico `localhost` é o próprio celular, e o endereço da
 * máquina de desenvolvimento não é adivinhável. Ele existe, porém, na URL do
 * Metro que carregou este código — é o mesmo IP da rede local. Ler dali evita
 * pedir configuração manual só para rodar no aparelho.
 */
function devHost(): string | null {
  if (Platform.OS === 'web') {
    return typeof window === 'undefined' ? null : window.location.hostname;
  }

  try {
    const source = (NativeModules as Record<string, { getConstants?: () => { scriptURL?: string }; scriptURL?: string } | undefined>).SourceCode;
    const scriptURL = source?.getConstants?.().scriptURL ?? source?.scriptURL;
    const host = scriptURL?.match(/^[a-z]+:\/\/([^/:]+)/i)?.[1];
    // O pacote pode vir embutido no aplicativo publicado; aí não há host de rede.
    return host && host !== 'localhost' && host !== '127.0.0.1' ? host : null;
  } catch {
    return null;
  }
}

/**
 * Endereço da API.
 *
 * `EXPO_PUBLIC_API_URL` vence sempre — é como se aponta para o servidor
 * publicado, e é obrigatória quando a API não está na mesma máquina que serve o
 * pacote. Sem ela valem, nesta ordem: o host do Metro, que resolve o aparelho
 * físico no Expo Go; o `10.0.2.2` do emulador Android, onde `localhost` é o
 * próprio emulador; e `localhost` no resto.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (() => {
    const host = devHost();
    if (host) return `http://${host}:${DEV_PORT}`;
    return Platform.OS === 'android' ? `http://10.0.2.2:${DEV_PORT}` : `http://localhost:${DEV_PORT}`;
  })();

/** Erro que a interface pode mostrar como está: a mensagem vem pronta do servidor. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly field?: string,
    /** Qual cadastro atingiu o limite, quando o servidor responde 402. */
    readonly resource?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Sessão vencida ou derrubada: quem trata é o provedor de sessão. */
  get isUnauthenticated() {
    return this.status === 401;
  }

  /** Limite do plano gratuito, com a explicação do que muda ao assinar. */
  get isPlanLimit() {
    return this.status === 402;
  }
}

type RequestOptions = { method?: string; body?: unknown; token?: string | null; signal?: AbortSignal };

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, signal } = options;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      signal,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // Servidor fora do ar ou aparelho sem rede: a usuária precisa saber que o
    // problema é a conexão, não o que ela digitou.
    throw new ApiError('Não conseguimos falar com o servidor. Confira sua conexão.', 0, 'offline');
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const data = (payload ?? {}) as { message?: string; error?: string; field?: string; resource?: string };
    throw new ApiError(
      data.message ?? 'Não conseguimos concluir agora. Tente novamente em instantes.',
      response.status,
      data.error,
      data.field,
      data.resource,
    );
  }

  return payload as T;
}

/** Corpo cru de uma resposta e o nome de arquivo que o servidor anunciou. */
export type DownloadedFile = { text: string; filename: string | null };

/**
 * Busca uma resposta para virar arquivo, sem interpretá-la.
 *
 * A exportação do `RF-12` é o único caminho em que o corpo não vira objeto: o
 * que a usuária leva embora é o arquivo como o servidor o escreveu. Interpretar
 * e reserializar guardaria duas cópias de um JSON que pode ser grande, e ainda
 * mudaria bytes que não são nossos para mudar.
 */
export async function apiDownload(
  path: string,
  options: { token?: string | null; signal?: AbortSignal } = {},
): Promise<DownloadedFile> {
  const { token, signal } = options;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      signal,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError('Não conseguimos falar com o servidor. Confira sua conexão.', 0, 'offline');
  }

  if (!response.ok) {
    const data = ((await response.json().catch(() => null)) ?? {}) as { message?: string; error?: string };
    throw new ApiError(
      data.message ?? 'Não conseguimos concluir agora. Tente novamente em instantes.',
      response.status,
      data.error,
    );
  }

  return { text: await response.text(), filename: filenameOf(response.headers.get('content-disposition')) };
}

/**
 * Nome do arquivo anunciado no `content-disposition`.
 *
 * Devolve `null` quando o cabeçalho não chega — no navegador ele não está na
 * lista que o CORS libera por padrão, e só aparece se o servidor o expuser.
 * Quem chama precisa, por isso, ter um nome de reserva.
 *
 * O nome é reduzido ao último trecho e limpo de barras e pontos duplos antes de
 * sair daqui: no aparelho ele vira caminho de arquivo, e um cabeçalho torto não
 * pode escolher onde o aplicativo escreve.
 */
function filenameOf(header: string | null): string | null {
  const match = header?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (!match) return null;

  const safe = decodeURIComponent(match[1].trim())
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.{2,}/g, '.')
    .trim();

  return safe ? safe : null;
}

/** Centavos do servidor viram reais na interface, e só aqui. */
export const fromCents = (cents: number): number => cents / 100;
/** Reais digitados viram centavos inteiros antes de subir. */
export const toCents = (value: number): number => Math.round(value * 100);

/** Percentual do servidor é ponto percentual; o banco guarda fração. */
export const percentToFraction = (percent: number): number => percent / 100;
