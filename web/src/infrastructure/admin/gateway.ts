import type {
  AdminOffer,
  AdminOverview,
  AdminSubscription,
  AdminDeletionRequest,
  AdminUser,
} from "@/application/use-cases/admin-panel";

/**
 * Conversa do painel com a API.
 *
 * O segredo viaja no cabeçalho `x-admin-secret` e fica no `sessionStorage`, e
 * não no `localStorage`: fechar a aba encerra o acesso. É a diferença entre um
 * segredo que some quando a pessoa vai embora e um que fica esperando no
 * navegador do computador compartilhado.
 */

const CHAVE = "beautyconta:admin-secret";
// A credencial validada continua disponível se o navegador bloquear a gravação.
// `undefined` significa que ainda precisamos recuperar a sessão desta aba.
let sessionSecret: string | null | undefined;

export class AdminAuthError extends Error {
  constructor() {
    super("Segredo inválido ou expirado.");
    this.name = "AdminAuthError";
  }
}

export function loadSecret(): string | null {
  if (sessionSecret !== undefined) return sessionSecret;
  try {
    return sessionStorage.getItem(CHAVE) || null;
  } catch {
    // Navegador com armazenamento bloqueado: o painel ainda funciona, só pede o
    // segredo de novo a cada recarga.
    return null;
  }
}

export function saveSecret(secret: string): void {
  sessionSecret = secret;
  try {
    sessionStorage.setItem(CHAVE, secret);
  } catch {
    // Sem onde guardar; seguir em frente é melhor do que impedir a entrada.
  }
  avisar();
}

export function clearSecret(): void {
  sessionSecret = null;
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
    // Nada a limpar.
  }
  avisar();
}

/**
 * O segredo como fonte observável.
 *
 * Existe para que a tela leia o estado da sessão sem copiá-lo para um `useState`
 * dentro de um efeito — o que criaria duas verdades sobre "estou autenticada" e
 * uma janela em que elas discordam.
 *
 * `getServerSnapshot` devolve `false` porque no servidor não há
 * `sessionStorage`: a primeira renderização mostra a tela de entrada, e o
 * cliente corrige em seguida se houver segredo guardado.
 */
const ouvintes = new Set<() => void>();

function avisar(): void {
  for (const ouvinte of ouvintes) ouvinte();
}

export function subscribeToSecret(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export const hasSecret = (): boolean => loadSecret() !== null;
export const hasSecretOnServer = (): boolean => false;

async function call<T>(path: string, init: RequestInit = {}, secret = loadSecret()): Promise<T> {
  const response = await fetch(`/api/admin${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-admin-secret": secret } : {}),
      ...init.headers,
    },
  });

  // O 401 tem tratamento próprio: é o único erro que significa "entre de novo",
  // e a tela precisa saber disso para voltar ao pedido de segredo.
  if (response.status === 401) throw new AdminAuthError();

  if (!response.ok) {
    const corpo = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(corpo?.message ?? "Não foi possível falar com o servidor.");
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const adminApi = {
  verifySecret: (secret: string) => call<AdminOverview>("/overview", {}, secret),
  overview: () => call<AdminOverview>("/overview"),

  plans: () =>
    call<{ offers: AdminOffer[]; limits: Record<string, Record<string, number | null>> }>("/plans"),

  saveOffer: (offer: {
    plan: string;
    billingPeriod: string;
    priceCents: number;
    isActive: boolean;
    benefits: string[];
  }) => call<AdminOffer>("/plans", { method: "PUT", body: JSON.stringify(offer) }),

  deleteOffer: (plan: string, billingPeriod: string) =>
    call<void>(`/plans/${plan}/${billingPeriod}`, { method: "DELETE" }),

  users: (params: { search?: string; limit?: number; offset?: number } = {}) =>
    call<{ items: AdminUser[]; total: number }>(`/users${query(params)}`),

  subscriptions: (params: { limit?: number; offset?: number } = {}) =>
    call<{ items: AdminSubscription[]; total: number }>(`/subscriptions${query(params)}`),

  deletionRequests: (status?: string) =>
    call<{ items: AdminDeletionRequest[] }>(`/account-deletion-requests${query({ status })}`),

  resolveDeletionRequest: (id: string, status: "done" | "rejected") =>
    call<{ id: string; status: string; handledAt: string | null }>(
      `/account-deletion-requests/${id}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
    ),
};

function query(params: Record<string, string | number | undefined>): string {
  const partes = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`);

  return partes.length > 0 ? `?${partes.join("&")}` : "";
}
