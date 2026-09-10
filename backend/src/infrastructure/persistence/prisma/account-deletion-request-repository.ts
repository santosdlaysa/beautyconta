import type { PrismaClient } from "@prisma/client";
import type { AccountDeletionRequestRecord } from "../../../application/ports/records";
import type { AccountDeletionRequestRepository } from "../../../application/ports/repositories";

/** Pedidos de exclusão de conta vindos do site. */
export class PrismaAccountDeletionRequestRepository implements AccountDeletionRequestRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: { email: string; note: string | null }): Promise<AccountDeletionRequestRecord> {
    return this.prisma.accountDeletionRequest.create({ data: input });
  }

  async list(options: {
    status?: AccountDeletionRequestRecord["status"];
    limit: number;
  }): Promise<AccountDeletionRequestRecord[]> {
    return this.prisma.accountDeletionRequest.findMany({
      ...(options.status ? { where: { status: options.status } } : {}),
      // Pendentes primeiro, e dentro delas as mais antigas: há prazo legal para
      // responder, e quem esperou mais é quem está mais perto de estourá-lo.
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take: options.limit,
    });
  }

  async resolve(
    id: string,
    status: "done" | "rejected",
    at: Date,
  ): Promise<AccountDeletionRequestRecord | null> {
    return this.prisma.accountDeletionRequest
      .update({ where: { id }, data: { status, handledAt: at } })
      .catch(() => null);
  }

  countPending(): Promise<number> {
    return this.prisma.accountDeletionRequest.count({ where: { status: "pending" } });
  }
}
