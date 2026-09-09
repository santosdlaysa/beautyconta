import type { Request, Response } from "express";
import type { Dependencies } from "../../../application/ports/dependencies";
import {
  ChangePassword,
  DeleteAccount,
  GetUser,
  RegisterUser,
  UpdateUser,
} from "../../../application/use-cases/accounts";
import { StartSession } from "../../../application/use-cases/sessions";
import { serializeSession, serializeUser } from "../mappers/serializers";
import { userIdOf } from "../middleware/identity";
import { parse } from "../validators/parse";
import { changePasswordSchema, createUserSchema, updateUserSchema } from "../validators/schemas";

export class AccountController {
  constructor(private readonly deps: Dependencies) {}

  /**
   * Cadastro. Já devolve a sessão: pedir e-mail e senha de novo na tela
   * seguinte seria cerimônia sem ganho de segurança nenhum.
   */
  create = async (req: Request, res: Response): Promise<void> => {
    const input = parse(createUserSchema, req.body);
    const user = await new RegisterUser(this.deps.users).execute(input);
    const session = await new StartSession(this.deps.sessions, this.deps.clock).execute(user);

    res.status(201).json(serializeSession(session));
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const user = await new GetUser(this.deps.users).execute(userIdOf(req));
    res.json(serializeUser(user));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const input = parse(updateUserSchema, req.body);
    const user = await new UpdateUser(this.deps.users).execute(userIdOf(req), input);
    res.json(serializeUser(user));
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    const input = parse(changePasswordSchema, req.body);
    await new ChangePassword(this.deps.users, this.deps.sessions).execute(userIdOf(req), input);

    // 204 e não 200: a troca encerrou as sessões, inclusive a que respondeu.
    res.status(204).end();
  };

  /** Exclusão efetiva: leva junto negócios, cadastros e histórico (`RF-12`). */
  remove = async (req: Request, res: Response): Promise<void> => {
    await new DeleteAccount(this.deps.users).execute(userIdOf(req));
    res.status(204).end();
  };
}
