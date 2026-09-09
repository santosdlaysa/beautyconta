import type { NextFunction, Request, Response } from "express";
import { ApplicationError, type ApplicationErrorCode } from "../../../application/errors";
import { PlanLimitError } from "../../../domain/billing/plan-limits";
import { DomainError } from "../../../domain/shared";
import { HttpValidationError } from "../validators/parse";

const STATUS_BY_CODE: Record<ApplicationErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
};

/**
 * Traduz erro para HTTP.
 *
 * A regra de fundo: o que a usuária pode corrigir vira resposta explicada, com
 * a mensagem que a interface exibe como está; o que ela não pode corrigir vira
 * 500 genérico, sem vazar detalhe interno.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  void _next;

  if (error instanceof HttpValidationError) {
    res.status(422).json({ error: "invalid_input", message: error.message, field: error.field });
    return;
  }

  // Limite de plano vem antes de DomainError porque estende dele. Nada está
  // inválido: o plano é que acabou, e a resposta explica o que muda ao assinar.
  if (error instanceof PlanLimitError) {
    res.status(402).json({
      error: "plan_limit_reached",
      message: error.message,
      resource: error.resource,
      limit: error.limit,
      plan: error.plan,
    });
    return;
  }

  if (error instanceof DomainError) {
    res.status(422).json({ error: "domain_error", message: error.message, field: error.field });
    return;
  }

  if (error instanceof ApplicationError) {
    res.status(STATUS_BY_CODE[error.code]).json({ error: error.code, message: error.message });
    return;
  }

  // Recurso externo ainda não configurado: a assinante não errou nada, e a
  // resposta precisa dizer isso sem prometer o que não existe.
  if (isGatewayNotConfigured(error)) {
    res.status(503).json({ error: "gateway_not_configured", message: error.message });
    return;
  }

  console.error("[erro nao tratado]", error);
  res.status(500).json({
    error: "internal_error",
    message: "Não conseguimos concluir agora. Tente novamente em instantes.",
  });
}

function isGatewayNotConfigured(error: unknown): error is Error & { code: string } {
  return (
    error instanceof Error &&
    (error as { code?: unknown }).code === "gateway_not_configured"
  );
}
