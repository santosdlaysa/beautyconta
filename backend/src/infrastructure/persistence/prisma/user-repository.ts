import type { PrismaClient, User } from "@prisma/client";
import { ConflictError } from "../../../application/errors";
import type { UserRepository } from "../../../application/ports/repositories";
import type { UserCredentialsRecord, UserRecord } from "../../../application/ports/records";

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBySocialIdentity(key: { provider: string; subject: string }): Promise<UserRecord | null> {
    const identity = await this.prisma.socialIdentity.findUnique({ where: { provider_subject: key }, include: { user: true } });
    return identity ? toRecord(identity.user) : null;
  }

  async linkSocialIdentity(userId: string, key: { provider: string; subject: string }): Promise<void> {
    try {
      await this.prisma.socialIdentity.create({ data: { ...key, userId } });
    } catch (error) { socialConflict(error); }
  }

  async createSocial(input: { provider: string; subject: string; name: string; email: string }): Promise<UserRecord> {
    const { provider, subject, ...profile } = input;
    try {
      return toRecord(await this.prisma.user.create({ data: {
        ...profile, emailVerifiedAt: new Date(), identities: { create: { provider, subject } },
      } }));
    } catch (error) { return socialConflict(error); }
  }

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

function socialConflict(error: unknown): never {
  if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
    throw new ConflictError("Este login já foi cadastrado. Tente entrar novamente.");
  }
  throw error;
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
