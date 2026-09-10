import type { Request, Response } from "express";
import type { Dependencies } from "../../../application/ports/dependencies";
import {
  ListAccountDeletionRequests,
  RequestAccountDeletion,
  ResolveAccountDeletionRequest,
} from "../../../application/use-cases/account-deletion-requests";
import { parse } from "../validators/parse";
import {
  accountDeletionRequestSchema,
  idParamSchema,
  resolveDeletionRequestSchema,
} from "../validators/schemas";

/**
 * Pedidos de exclusão de conta.
 *
 * A rota de criação é pública porque quem precisa dela é justamente quem não
 * consegue entrar. As de leitura e tratamento vivem no painel.
 */
export class AccountDeletionController {
  constructor(private readonly deps: Dependencies) {}

  request = async (req: Request, res: Response): Promise<void> => {
    const input = parse(accountDeletionRequestSchema, req.body);

    await new RequestAccountDeletion(
      this.deps.accountDeletionRequests,
      this.deps.notifier,
      this.deps.clock,
    ).execute(input);

    /**
     * A mesma resposta, exista a conta ou não.
     *
     * Responder diferente transformaria esta rota num detector de contas:
     * bastaria enviar e-mails e observar a diferença para descobrir quem tem
     * conta no BeautyConta.
     */
    res.status(202).json({
      message:
        "Recebemos seu pedido. Vamos confirmar sua identidade pelo e-mail informado antes de apagar os dados.",
    });
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const status = req.query.status;
    const items = await new ListAccountDeletionRequests(this.deps.accountDeletionRequests).execute({
      ...(status === "pending" || status === "done" || status === "rejected" ? { status } : {}),
    });

    res.json({
      items: items.map((item) => ({
        id: item.id,
        email: item.email,
        note: item.note,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        handledAt: item.handledAt?.toISOString() ?? null,
      })),
    });
  };

  resolve = async (req: Request, res: Response): Promise<void> => {
    const { id } = parse(idParamSchema, req.params);
    const { status } = parse(resolveDeletionRequestSchema, req.body);

    const atualizado = await new ResolveAccountDeletionRequest(
      this.deps.accountDeletionRequests,
      this.deps.clock,
    ).execute(id, status);

    res.json({
      id: atualizado.id,
      status: atualizado.status,
      handledAt: atualizado.handledAt?.toISOString() ?? null,
    });
  };
}
