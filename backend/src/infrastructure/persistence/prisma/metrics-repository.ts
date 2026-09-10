import type { PrismaClient } from "@prisma/client";
import { GRANTS_ACCESS } from "../../../domain/billing/subscription-access";
import type { AdminMetrics, MetricsRepository } from "../../../application/ports/repositories";

/**
 * Contagens do relatório administrativo.
 *
 * As cinco consultas vão juntas num `$transaction`: é uma leitura só, e cinco
 * idas soltas ao banco poderiam contar usuárias antes e agendamentos depois de
 * um cadastro, produzindo um relatório que não bate consigo mesmo.
 *
 * "Assinaturas ativas" reusa o mesmo `GRANTS_ACCESS` que decide o acesso de
 * verdade. Contar apenas `active` esconderia quem está em carência de cobrança
 * e continua usando o plano pago — o relatório diria uma coisa e o sistema
 * faria outra.
 *
 * Só conta o que não foi excluído: conta apagada permanece na tabela pela
 * cascata do `RF-01`, e somá-la inflaria o total para sempre.
 */
export class PrismaMetricsRepository implements MetricsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async snapshot(since: Date): Promise<AdminMetrics> {
    const [totalUsers, newUsersToday, totalBusinesses, appointmentsToday, activeSubscriptions] =
      await this.prisma.$transaction([
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.user.count({ where: { deletedAt: null, createdAt: { gte: since } } }),
        this.prisma.business.count(),
        // Agendamentos *marcados* hoje, e não os que ocorrem hoje: o relatório
        // mede movimento do dia, e uma agenda cheia de compromissos marcados na
        // semana passada não diz nada sobre hoje.
        this.prisma.appointment.count({ where: { createdAt: { gte: since } } }),
        this.prisma.subscription.count({ where: { status: { in: [...GRANTS_ACCESS] } } }),
      ]);

    return {
      totalUsers,
      newUsersToday,
      totalBusinesses,
      appointmentsToday,
      activeSubscriptions,
    };
  }
}
