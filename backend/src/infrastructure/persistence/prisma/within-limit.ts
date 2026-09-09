import { Prisma, type PrismaClient } from "@prisma/client";

/**
 * Executa contagem e inserção como uma operação só.
 *
 * A janela entre contar e inserir é o que deixava vinte requisições paralelas
 * lerem a mesma contagem, passarem todas pela verificação e inserirem todas.
 *
 * O fechamento é um bloqueio de linha — `SELECT ... FOR UPDATE` sobre a linha
 * dona da cota, dentro da transação — e não isolamento `Serializable`. A
 * diferença importa: com `Serializable`, o PostgreSQL **aborta** as transações
 * concorrentes com `40001`, e medindo aqui contra o banco de verdade isso
 * transformou 25 inserções simultâneas em 8 criadas e 17 erros de servidor,
 * mesmo com o limite longe de ser atingido. Repetir não resolvia: cada nova
 * tentativa recaía na mesma disputa.
 *
 * Com o bloqueio de linha, as concorrentes **esperam** em fila e todas
 * terminam: as que couberem no limite entram, as demais recebem a negativa de
 * plano — que é a resposta correta, e não um 500.
 */

/** Quem é dono da cota: o negócio, ou a conta quando a cota é de negócios. */
export type QuotaOwner = { table: "businesses" | "users"; id: string };

export async function createWithinLimit<T>(
  prisma: PrismaClient,
  owner: QuotaOwner,
  limit: number | null,
  count: (tx: Prisma.TransactionClient) => Promise<number>,
  create: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T | null> {
  // Sem teto não há o que proteger, e a transação seria custo puro.
  if (limit === null) return create(prisma);

  return prisma.$transaction(
    async (tx) => {
      // O nome da tabela vem de um literal do próprio código, nunca de entrada
      // da requisição; só o identificador é parâmetro.
      const lock =
        owner.table === "businesses"
          ? Prisma.sql`SELECT id FROM "businesses" WHERE id = ${owner.id}::uuid FOR UPDATE`
          : Prisma.sql`SELECT id FROM "users" WHERE id = ${owner.id}::uuid FOR UPDATE`;

      const linhas = await tx.$queryRaw<{ id: string }[]>(lock);

      // Dona da cota inexistente: quem trata é a camada de aplicação, que já
      // conferiu o acesso antes de chegar aqui.
      if (linhas.length === 0) return null;

      return (await count(tx)) >= limit ? null : await create(tx);
    },
    {
      // O padrão do Prisma — 2 s de espera e 5 s de transação — é curto demais
      // para uma fila de bloqueio contra banco remoto: medindo daqui contra o
      // Render, 25 inserções simultâneas levaram 7 s no total e 21 delas
      // morreram com `P2028`, virando erro de servidor no lugar da negativa de
      // plano. O trabalho dentro da transação é curto; o que demora é a fila.
      maxWait: 15_000,
      timeout: 30_000,
    },
  );
}
