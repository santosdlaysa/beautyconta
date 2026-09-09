import { createHash, randomBytes } from "node:crypto";

/**
 * Token de sessão.
 *
 * O aplicativo guarda o token em claro; o banco guarda só o resumo SHA-256.
 * Vazamento da tabela `sessions` não devolve nenhuma sessão utilizável, e a
 * busca continua sendo uma consulta por índice único — o resumo é determinístico
 * de propósito, ao contrário do hash de senha.
 */

const TOKEN_BYTES = 32;

/** Trinta dias: sessão longa como o aplicativo espera, mas não eterna. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function createSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashSessionToken(token) };
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
