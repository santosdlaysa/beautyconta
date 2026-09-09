import { PrismaClient } from "@prisma/client";

/**
 * Instância única do Prisma. Em desenvolvimento o `tsx watch` recarrega o
 * módulo a cada alteração; guardar o cliente no escopo global evita abrir uma
 * conexão nova a cada recarga e esgotar o pool do PostgreSQL.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Verifica se o banco responde. Usado pela rota `/health/db`. */
export async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
