import { assertUsablePassword, hashPassword, verifyPassword } from "../../domain/auth/password";
import { ConflictError, NotFoundError, UnauthenticatedError } from "../errors";
import type { SessionRepository, UserRepository } from "../ports/repositories";
import type { UserRecord } from "../ports/records";

/**
 * Conta da usuária.
 *
 * A senha vive aqui por decisão da dona do produto, e não pelo ADR-0003 — que
 * previa um provedor gerenciado e deixou o item D-01 bloqueado. O que este
 * arquivo conhece de credencial é apenas o hash: derivar e conferir são
 * responsabilidade de `domain/auth/password`, e trocar o provedor depois é
 * trocar quem chama `RegisterUser`, não o que ele faz.
 */
export class RegisterUser {
  constructor(private readonly users: UserRepository) {}

  async execute(input: { name: string; email: string; password: string }): Promise<UserRecord> {
    const email = normalizeEmail(input.email);
    // A senha é validada antes da consulta: gastar ida ao banco para recusar
    // "12345" depois seria trabalho jogado fora.
    assertUsablePassword(input.password);

    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictError("Já existe uma conta com este e-mail.");
    }

    return this.users.create({
      name: input.name.trim(),
      email,
      passwordHash: await hashPassword(input.password),
    });
  }
}

/**
 * Entrada por e-mail e senha.
 *
 * A mesma negativa para e-mail inexistente, senha errada e conta excluída: a
 * resposta não é lugar de descobrir quem tem cadastro. Quando não há conta,
 * `verifyPassword` deriva contra um hash descartável em vez de sair na hora,
 * para que o tempo de resposta não denuncie a diferença — a negativa idêntica
 * não adianta nada se o relógio responde antes dela.
 */
export class AuthenticateUser {
  constructor(private readonly users: UserRepository) {}

  async execute(input: { email: string; password: string }): Promise<UserRecord> {
    const email = normalizeEmail(input.email);
    const credentials = await this.users.findCredentialsByEmail(email);
    const matches = await verifyPassword(input.password, credentials?.passwordHash ?? null);

    if (!credentials || credentials.deletedAt || !matches) {
      throw new UnauthenticatedError("E-mail ou senha não conferem.");
    }

    return new GetUser(this.users).execute(credentials.id);
  }
}

/**
 * Troca de senha pela própria dona da conta.
 *
 * Exige a senha atual mesmo já havendo sessão válida: sessão roubada não vira
 * conta roubada. Encerra as demais sessões, que é o efeito que a usuária espera
 * de trocar a senha depois de um susto.
 */
export class ChangePassword {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
  ) {}

  async execute(userId: string, input: { currentPassword: string; newPassword: string }): Promise<void> {
    const user = await new GetUser(this.users).execute(userId);
    const credentials = await this.users.findCredentialsByEmail(user.email);

    if (!(await verifyPassword(input.currentPassword, credentials?.passwordHash ?? null))) {
      throw new UnauthenticatedError("A senha atual não confere.");
    }

    assertUsablePassword(input.newPassword);
    await this.users.updatePassword(userId, await hashPassword(input.newPassword));
    await this.sessions.deleteAllForUser(userId);
  }
}

export class GetUser {
  constructor(private readonly users: UserRepository) {}

  async execute(id: string): Promise<UserRecord> {
    const user = await this.users.findById(id);
    if (!user || user.deletedAt) throw new NotFoundError("Conta", "f");
    return user;
  }
}

export class UpdateUser {
  constructor(private readonly users: UserRepository) {}

  async execute(id: string, input: { name: string }): Promise<UserRecord> {
    await new GetUser(this.users).execute(id);
    return this.users.update(id, { name: input.name.trim() });
  }
}

/**
 * Exclusão de conta com remoção efetiva, exigida por `RF-01` e `RF-12`.
 *
 * A cascata do banco leva junto negócios, materiais, custos, serviços e
 * cálculos. Não é arquivamento: a usuária pediu para sumir.
 */
export class DeleteAccount {
  constructor(private readonly users: UserRepository) {}

  async execute(id: string): Promise<void> {
    await new GetUser(this.users).execute(id);
    await this.users.delete(id);
  }
}

/** E-mail normalizado, como manda o documento 04: minúsculo e sem espaços. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
