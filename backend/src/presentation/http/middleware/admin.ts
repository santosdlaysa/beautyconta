import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { AdminConfig } from "../../../application/ports/dependencies";

/**
 * Porta do painel administrativo.
 *
 * Duas formas de entrar, como no painel que serviu de referência:
 *
 * 1. o cabeçalho `x-admin-secret`, usado pelo painel na web;
 * 2. a sessão de uma conta cujo e-mail está na lista de administradores.
 *
 * **Sem segredo configurado, a primeira forma não existe** — e é falha fechada
 * de propósito. Um painel que aceita qualquer requisição quando alguém esquece
 * a variável de ambiente não avisa ninguém: só entrega a lista de usuárias e o
 * poder de conceder plano a quem descobrir a URL.
 */

/** Quem está autenticado como administrador, para a trilha de auditoria. */
export type AdminIdentity = { via: "secret" } | { via: "session"; userId: string; email: string };

declare module "express-serve-static-core" {
  interface Request {
    admin?: AdminIdentity;
  }
}

export type AdminLookup = (userId: string) => Promise<{ email: string } | null>;

export function createAdminGuard(config: AdminConfig, lookup: AdminLookup) {
  const permitidos = new Set(config.emails.map((email) => email.trim().toLowerCase()).filter(Boolean));

  return async function requireAdmin(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (matchesSecret(req, config.secret)) {
      req.admin = { via: "secret" };
      next();
      return;
    }

    const identity = await adminBySession(req, lookup, permitidos);
    if (identity) {
      req.admin = identity;
      next();
      return;
    }

    // A mesma resposta para segredo errado, sessão comum e ausência de
    // credencial: distinguir os casos diria a quem sonda qual porta existe.
    res.status(401).json({ error: "unauthorized", message: "Acesso restrito." });
  };
}

/**
 * Comparação em tempo constante.
 *
 * Comparar com `===` vaza o tamanho do prefixo correto pelo tempo de resposta, e
 * o segredo do painel é exatamente o tipo de valor que compensa adivinhar
 * caractere a caractere.
 */
function matchesSecret(req: Request, secret: string | null): boolean {
  if (!secret) return false;

  const provided = req.headers["x-admin-secret"];
  if (typeof provided !== "string" || !provided) return false;

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(secret, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function adminBySession(
  req: Request,
  lookup: AdminLookup,
  permitidos: ReadonlySet<string>,
): Promise<AdminIdentity | null> {
  const userId = req.userId;
  if (!userId || permitidos.size === 0) return null;

  const user = await lookup(userId);
  const email = user?.email.trim().toLowerCase();

  return email && permitidos.has(email) ? { via: "session", userId, email } : null;
}
