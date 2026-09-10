import { DomainError } from "../../domain/shared";
import { normalizeEmail } from "./accounts";
import type { AccountDeletionRequestRecord } from "../ports/records";
import type { AccountDeletionRequestRepository, Clock } from "../ports/repositories";
import type { Notifier } from "../ports/notifications";

/**
 * Pedido de exclusão de conta feito de fora do aplicativo.
 *
 * Para quem **não consegue entrar** — desinstalou, esqueceu a senha, trocou de
 * aparelho. Quem está dentro apaga a própria conta na hora, sem passar por aqui.
 *
 * Apple e Google exigem este caminho público em todo aplicativo que cria conta:
 * sem ele a submissão é recusada.
 */
export class RequestAccountDeletion {
  constructor(
    private readonly requests: AccountDeletionRequestRepository,
    private readonly notifier: Notifier,
    private readonly clock: Clock,
  ) {}

  async execute(input: { email: string; note?: string }): Promise<void> {
    const email = normalizeEmail(input.email);

    if (!email.includes("@") || email.length > 254) {
      throw new DomainError("Informe o e-mail da conta que você quer apagar.", "email");
    }

    /**
     * O pedido é gravado sem conferir se a conta existe.
     *
     * Conferir aqui transformaria esta rota num detector de contas: bastaria
     * enviar e-mails e observar a diferença de resposta para descobrir quem tem
     * conta no BeautyConta. Quem trata o pedido confere depois, com calma.
     */
    const pedido = await this.requests.create({
      email,
      note: input.note?.trim().slice(0, 1000) || null,
    });

    // O aviso é o que faz o pedido chegar a alguém. Sem ele o registro ficaria
    // no banco esperando que alguém lembrasse de olhar.
    await this.notifier.notify({
      kind: "account_deletion_request",
      email,
      note: pedido.note,
      requestedAt: this.clock.now(),
    });
  }
}

export class ListAccountDeletionRequests {
  constructor(private readonly requests: AccountDeletionRequestRepository) {}

  execute(options: { status?: AccountDeletionRequestRecord["status"]; limit?: number }) {
    return this.requests.list({
      ...(options.status ? { status: options.status } : {}),
      limit: Math.min(Math.max(options.limit ?? 100, 1), 200),
    });
  }
}

/**
 * Marca o pedido como tratado.
 *
 * **Não apaga a conta.** Apagar exige confirmar que quem pediu é mesmo a dona do
 * e-mail — e essa conferência é humana, como a própria política de privacidade
 * avisa. Este caso de uso registra o desfecho; a exclusão em si passa pelo mesmo
 * caminho de sempre.
 */
export class ResolveAccountDeletionRequest {
  constructor(
    private readonly requests: AccountDeletionRequestRepository,
    private readonly clock: Clock,
  ) {}

  async execute(id: string, status: "done" | "rejected"): Promise<AccountDeletionRequestRecord> {
    const atualizado = await this.requests.resolve(id, status, this.clock.now());
    if (!atualizado) throw new DomainError("Pedido não encontrado.", "id");

    return atualizado;
  }
}
