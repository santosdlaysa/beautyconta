import type { PrismaClient, User } from "@prisma/client";
import type { UserRepository } from "../../../application/ports/repositories";
import type { UserCredentialsRecord, UserRecord } from "../../../application/ports/records";

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: { name: string; email: string; passwordHash: string }): Promise<UserRecord> {
    return toRecord(await this.prisma.user.create({ data: input }));
  }

  async findById(id: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? toRecord(user) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? toRecord(user) : null;
  }

  /** Projeção estreita de propósito: só o que a conferência de senha precisa. */
  async findCredentialsByEmail(email: string): Promise<UserCredentialsRecord | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true, deletedAt: true },
    });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  async update(id: string, input: { name?: string }): Promise<UserRecord> {
    return toRecord(await this.prisma.user.update({ where: { id }, data: input }));
  }

  /** Remoção efetiva: a cascata do schema leva negócios e todo o resto junto. */
  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}

function toRecord(user: User): UserRecord {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    deletedAt: user.deletedAt,
  };
}
