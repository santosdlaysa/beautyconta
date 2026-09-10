import type { PrismaClient } from "@prisma/client";
import type { PlanOfferRepository } from "../../../application/ports/repositories";
import type { PlanOfferRecord } from "../../../application/ports/records";

/**
 * Ofertas de assinatura no banco.
 *
 * O preço mora aqui, e não em variável de ambiente, para que possa mudar sem
 * publicar servidor — quem edita é o painel administrativo.
 */
export class PrismaPlanOfferRepository implements PlanOfferRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(options: { onlyActive?: boolean } = {}): Promise<PlanOfferRecord[]> {
    const rows = await this.prisma.planOffer.findMany({
      ...(options.onlyActive ? { where: { isActive: true } } : {}),
      orderBy: [{ plan: "asc" }, { billingPeriod: "asc" }],
    });

    // `FREE` não é oferta: ele é a ausência de assinatura. Uma linha assim só
    // existiria por engano de escrita direta no banco, e vendê-la mostraria um
    // preço para o plano que não se compra.
    return rows.filter((row) => row.plan !== "FREE").map(toRecord);
  }

  /**
   * Grava a oferta de um plano e período.
   *
   * `upsert` porque o par plano+período é a identidade da oferta: editar o preço
   * do Premium mensal não pode criar um segundo Premium mensal.
   */
  async save(input: {
    plan: PlanOfferRecord["plan"];
    billingPeriod: PlanOfferRecord["billingPeriod"];
    priceCents: number;
    isActive: boolean;
    benefits: string[];
  }): Promise<PlanOfferRecord> {
    const row = await this.prisma.planOffer.upsert({
      where: { plan_billingPeriod: { plan: input.plan, billingPeriod: input.billingPeriod } },
      create: input,
      update: {
        priceCents: input.priceCents,
        isActive: input.isActive,
        benefits: input.benefits,
      },
    });

    return toRecord(row);
  }

  async delete(
    plan: PlanOfferRecord["plan"],
    billingPeriod: PlanOfferRecord["billingPeriod"],
  ): Promise<void> {
    await this.prisma.planOffer
      .delete({ where: { plan_billingPeriod: { plan, billingPeriod } } })
      .catch(() => undefined);
  }
}

function toRecord(row: {
  id: string;
  plan: "PREMIUM" | "MASTER" | "FREE";
  billingPeriod: PlanOfferRecord["billingPeriod"];
  priceCents: number;
  isActive: boolean;
  benefits: string[];
  updatedAt: Date;
}): PlanOfferRecord {
  return {
    id: row.id,
    plan: row.plan === "MASTER" ? "MASTER" : "PREMIUM",
    billingPeriod: row.billingPeriod,
    priceCents: row.priceCents,
    isActive: row.isActive,
    benefits: row.benefits,
    updatedAt: row.updatedAt,
  };
}
