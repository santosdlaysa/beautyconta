import type { Request, Response } from "express";
import type { Dependencies } from "../../../application/ports/dependencies";
import { AuthenticateUser } from "../../../application/use-cases/accounts";
import { EndSession, StartSession } from "../../../application/use-cases/sessions";
import { serializeSession } from "../mappers/serializers";
import { sessionTokenOf } from "../middleware/identity";
import { parse } from "../validators/parse";
import { signInSchema } from "../validators/schemas";

export class SessionController {
  constructor(private readonly deps: Dependencies) {}

  /** Entrada: confere a senha e devolve o token que o aplicativo guarda. */
  create = async (req: Request, res: Response): Promise<void> => {
    const input = parse(signInSchema, req.body);
    const user = await new AuthenticateUser(this.deps.users).execute(input);
    const session = await new StartSession(this.deps.sessions, this.deps.clock).execute(user);

    res.status(201).json(serializeSession(session));
  };

  /** Saída: encerra só a sessão deste aparelho. */
  destroy = async (req: Request, res: Response): Promise<void> => {
    await new EndSession(this.deps.sessions).execute(sessionTokenOf(req));
    res.status(204).end();
  };
}
