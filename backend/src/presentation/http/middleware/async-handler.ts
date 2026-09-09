import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Encaminha a rejeição de um handler assíncrono para o `errorHandler`.
 *
 * O Express 5 já faz isso sozinho, mas declarar explicitamente mantém a
 * intenção visível e protege contra a diferença de comportamento caso a versão
 * mude.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
