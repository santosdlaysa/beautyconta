import type { ErrorRequestHandler, Request, Response } from "express";
import type { Notifier } from "../../../application/ports/notifications";
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
 * Traduz erro para HTTP, com aviso administrativo no 500.
 *
 * A regra de fundo: o que a usuária pode corrigir vira resposta explicada, com
 * a mensagem que a interface exibe como está; o que ela não pode corrigir vira
 * 500 genérico, sem vazar detalhe interno.
 *
 * Só esse 500 vira aviso no Telegram. Validação, limite de plano e erro de
 * domínio são a usuária esbarrando numa regra — comportamento previsto, e não
 * defeito — e mandá-los ao grupo encheria de ruído até ninguém mais olhar.
 */
export function createErrorHandler(options: {
  notifier: Notifier;
  alertOnServerError: boolean;
}): ErrorRequestHandler {
  return (error, req, res, next) => {
    void next;
    const unhandled = handleError(error, req, res);

    if (unhandled && options.alertOnServerError) {
      void options.notifier.notify({
        kind: "server_error",
        method: req.method,
        path: req.path,
        statusCode: 500,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

/** Devolve `true` quando caiu no 500 genérico — ou seja: ninguém previu isso. */
function handleError(error: unknown, _req: Request, res: Response): boolean {

  if (error instanceof HttpValidationError) {
    res.status(422).json({ error: "invalid_input", message: error.message, field: error.field });
    return false;
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
    return false;
  }

  if (error instanceof DomainError) {
    res.status(422).json({ error: "domain_error", message: error.message, field: error.field });
    return false;
  }

  if (error instanceof ApplicationError) {
    res.status(STATUS_BY_CODE[error.code]).json({ error: error.code, message: error.message });
    return false;
  }

  // Recurso externo ainda não configurado: a assinante não errou nada, e a
  // resposta precisa dizer isso sem prometer o que não existe.
  if (isGatewayNotConfigured(error)) {
    res.status(503).json({ error: "gateway_not_configured", message: error.message });
    return false;
  }

  console.error("[erro nao tratado]", error);
  res.status(500).json({
    error: "internal_error",
    message: "Não conseguimos concluir agora. Tente novamente em instantes.",
  });
  return true;
}

function isGatewayNotConfigured(error: unknown): error is Error & { code: string } {
  return (
    error instanceof Error &&
    (error as { code?: unknown }).code === "gateway_not_configured"
  );
}
