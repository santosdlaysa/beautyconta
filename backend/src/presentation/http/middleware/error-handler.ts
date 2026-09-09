import type { NextFunction, Request, Response } from "express";
import { DomainError } from "../../../domain/shared";

/**
 * Traduz erro para HTTP. Erro de domínio vira 422 com mensagem para a usuária;
 * o resto vira 500 genérico, sem vazar detalhe interno na resposta.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  void _next;
  if (error instanceof DomainError) {
    res.status(422).json({ error: "domain_error", message: error.message, field: error.field });
    return;
  }

  console.error("[erro nao tratado]", error);
  res.status(500).json({
    error: "internal_error",
    message: "Não conseguimos concluir agora. Tente novamente em instantes.",
  });
}
