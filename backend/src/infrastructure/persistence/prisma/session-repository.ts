import type { PrismaClient, Session } from "@prisma/client";
import type { SessionRepository } from "../../../application/ports/repositories";
import type { SessionRecord } from "../../../application/ports/records";

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<SessionRecord> {
    return toRecord(await this.prisma.session.create({ data: input }));
  }

  /** A validade entra na consulta: sessão vencida nunca chega à aplicação. */
  async findValidByTokenHash(tokenHash: string, now: Date): Promise<SessionRecord | null> {
    const session = await this.prisma.session.findFirst({
      where: { tokenHash, expiresAt: { gt: now } },
    });
    return session ? toRecord(session) : null;
  }

  async touch(id: string, now: Date): Promise<void> {
    await this.prisma.session.update({ where: { id }, data: { lastUsedAt: now } });
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    // `deleteMany` porque sair duas vezes não é erro: a segunda não acha nada.
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}

function toRecord(session: Session): SessionRecord {
  return {
    id: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
  };
}
