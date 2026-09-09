import { createSessionToken, hashSessionToken, SESSION_TTL_MS } from "../../domain/auth/session-token";
import { UnauthenticatedError } from "../errors";
import type { Clock, SessionRepository, UserRepository } from "../ports/repositories";
import type { UserRecord } from "../ports/records";

export type StartedSession = { token: string; expiresAt: Date; user: UserRecord };

/**
 * Sessão persistente do aplicativo.
 *
 * O token em claro existe em um único ponto do sistema — o retorno de
 * `StartSession` — e daí em diante só circula o resumo. Nem o repositório, nem
 * o registro, nem o log voltam a ver o valor original.
 */
export class StartSession {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(user: UserRecord): Promise<StartedSession> {
    const { token, tokenHash } = createSessionToken();
    const expiresAt = new Date(this.clock.now().getTime() + SESSION_TTL_MS);

    await this.sessions.create({ userId: user.id, tokenHash, expiresAt });

    return { token, expiresAt, user };
  }
}

/**
 * Resolve o token que chega no cabeçalho.
 *
 * Devolve `null` em vez de lançar: quem decide se a rota exigia identidade é o
 * middleware, não este caso de uso — a calculadora pública aceita requisição
 * sem sessão e com sessão vencida do mesmo jeito.
 */
export class ResolveSession {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly users: UserRepository,
    private readonly clock: Clock,
  ) {}

  async execute(token: string): Promise<string | null> {
    const now = this.clock.now();
    const session = await this.sessions.findValidByTokenHash(hashSessionToken(token), now);
    if (!session) return null;

    // Conta excluída depois da sessão criada: a cascata do banco derruba as
    // sessões, mas a checagem aqui protege quem monta outra infraestrutura.
    const user = await this.users.findById(session.userId);
    if (!user || user.deletedAt) return null;

    await this.sessions.touch(session.id, now);
    return session.userId;
  }
}

/** Sair da conta neste aparelho. Encerrar em todos é troca de senha. */
export class EndSession {
  constructor(private readonly sessions: SessionRepository) {}

  async execute(token: string): Promise<void> {
    if (!token) throw new UnauthenticatedError();
    await this.sessions.deleteByTokenHash(hashSessionToken(token));
  }
}
