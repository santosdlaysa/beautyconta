/**
 * Erro esperado de negócio: entrada inválida, limite atingido, combinação
 * impossível de taxa e margem.
 *
 * A mensagem é escrita para a usuária, em português e sem jargão, porque chega
 * à interface como está. `field` permite destacar o campo culpado, conforme o
 * item A-02 do backlog.
 */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
