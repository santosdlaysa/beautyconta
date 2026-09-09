import type { z } from "zod";

/**
 * Falha de validação de borda.
 *
 * Carrega o campo culpado porque o item A-02 exige que a interface consiga
 * destacar exatamente o que precisa ser corrigido, em vez de mostrar um erro
 * genérico.
 */
export class HttpValidationError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "HttpValidationError";
  }
}

/**
 * Valida a entrada e devolve o dado já tipado.
 *
 * A validação aqui é o filtro grosseiro contra lixo, estouro e tipo errado. As
 * faixas de negócio continuam sendo verificadas no domínio, que é quem sabe
 * explicar o motivo à usuária.
 */
export function parse<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  message = "Confira os dados informados.",
): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const first = result.error.issues[0];
    throw new HttpValidationError(message, first?.path.join("."));
  }

  return result.data;
}
