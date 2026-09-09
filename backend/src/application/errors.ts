/**
 * Erros de aplicação: coisas que dão errado na orquestração, não na regra de
 * cálculo. O código é estável e a apresentação o traduz para HTTP — a camada de
 * aplicação não conhece status code.
 */
export type ApplicationErrorCode =
  | "not_found"
  | "forbidden"
  | "conflict"
  | "unauthenticated";

export class ApplicationError extends Error {
  constructor(
    message: string,
    readonly code: ApplicationErrorCode,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

/**
 * Recurso inexistente **ou** pertencente a outro negócio.
 *
 * A mesma resposta para os dois casos é deliberada: dizer "existe, mas não é
 * seu" já vaza a existência do registro alheio. O item B-03 exige negativa, não
 * explicação.
 */
export class NotFoundError extends ApplicationError {
  constructor(what = "Registro") {
    super(`${what} não encontrado.`, "not_found");
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message = "Você não tem acesso a este negócio.") {
    super(message, "forbidden");
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string) {
    super(message, "conflict");
    this.name = "ConflictError";
  }
}

export class UnauthenticatedError extends ApplicationError {
  constructor(message = "Entre na sua conta para continuar.") {
    super(message, "unauthenticated");
    this.name = "UnauthenticatedError";
  }
}
