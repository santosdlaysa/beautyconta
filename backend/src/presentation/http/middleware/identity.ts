import type { NextFunction, Request, RequestHandler, Response } from "express";
import { UnauthenticatedError } from "../../../application/errors";
import type { Dependencies } from "../../../application/ports/dependencies";
import { ResolveSession } from "../../../application/use-cases/sessions";

declare module "express-serve-static-core" {
  interface Request {
    /** Identificador da usuária autenticada, resolvido antes de qualquer rota privada. */
    userId?: string;
    /** Token em claro da requisição, usado apenas para encerrar a sessão. */
    sessionToken?: string;
  }
}

/**
 * Identidade da requisição.
 *
 * A sessão chega como `Authorization: Bearer <token>`, é resolvida contra o
 * resumo gravado em `sessions` e some da requisição se estiver vencida. Todo o
 * resto da API continua dependendo apenas de `req.userId` — foi o que permitiu
 * trocar o cabeçalho provisório por sessão de verdade mexendo só neste arquivo.
 *
 * O que ainda não existe: verificação de e-mail e recuperação de senha por
 * link, que dependem de um serviço de e-mail ainda não contratado.
 */
export function resolveIdentity(deps: Dependencies): RequestHandler {
  const resolveSession = new ResolveSession(deps.sessions, deps.users, deps.clock);

  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = bearerToken(req);
    if (!token) {
      next();
      return;
    }

    req.sessionToken = token;
    resolveSession
      .execute(token)
      .then((userId) => {
        if (userId) req.userId = userId;
        next();
      })
      // Falha ao consultar a sessão é falha de infraestrutura, não negativa de
      // acesso: quem traduz para 500 é o tratador de erros.
      .catch(next);
  };
}

function bearerToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header) return null;

  const [scheme, value] = header.split(" ");
  if (!scheme || !value || scheme.toLowerCase() !== "bearer") return null;

  const token = value.trim();
  return token.length > 0 ? token : null;
}

/** Barra a rota privada quando não há usuária identificada. */
export function requireUser(req: Request, _res: Response, next: NextFunction): void {
  if (!req.userId) {
    next(new UnauthenticatedError());
    return;
  }
  next();
}

/** Lê a identidade já validada. Só é chamada depois de `requireUser`. */
export function userIdOf(req: Request): string {
  if (!req.userId) throw new UnauthenticatedError();
  return req.userId;
}

/** Token da requisição atual, para encerrar exatamente esta sessão. */
export function sessionTokenOf(req: Request): string {
  if (!req.sessionToken) throw new UnauthenticatedError();
  return req.sessionToken;
}
