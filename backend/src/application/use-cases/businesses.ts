import { limitFor, PlanLimitError } from "../../domain/billing/plan-limits";
import { effectivePlan } from "../../domain/billing/subscription-access";
import type { SegmentSlug, WorkModelSlug } from "../../domain/catalog/catalogs";
import { NotFoundError } from "../errors";
import type {
  BusinessRepository,
  SubscriptionRepository,
  UserRepository,
} from "../ports/repositories";
import type {
  AllocationMethodSlug,
  BusinessRecord,
  BusinessSettingsRecord,
  RoundingStrategySlug,
} from "../ports/records";
import type { BusinessAccess } from "../services/business-access";

export type CreateBusinessInput = {
  name?: string | null;
  primaryCategory: SegmentSlug;
  /** Outros segmentos atendidos, da primeira etapa do onboarding. */
  secondaryCategories?: SegmentSlug[];
  workModel: WorkModelSlug;
  timezone?: string;
};

export class CreateBusiness {
  constructor(
    private readonly businesses: BusinessRepository,
    private readonly users: UserRepository,
    private readonly subscriptions: SubscriptionRepository,
  ) {}

  async execute(ownerUserId: string, input: CreateBusinessInput): Promise<BusinessRecord> {
    const owner = await this.users.findById(ownerUserId);
    if (!owner || owner.deletedAt) throw new NotFoundError("Conta", "f");

    // O plano vale por negócio, e aqui ainda não existe negócio: o teto é o do
    // melhor plano entre os que a pessoa já tem. Sem esta verificação, criar
    // negócios era a maneira mais fácil de contornar todos os outros limites.
    const existing = await this.businesses.listByOwner(ownerUserId);
    const plans = await Promise.all(
      existing.map((business) => this.subscriptions.listByBusiness(business.id)),
    );
    const plan = effectivePlan(plans.flat());
    const limit = limitFor(plan, "businesses");

    const created = await this.businesses.createWithinLimit(
      {
        ownerUserId,
        name: input.name?.trim() || null,
        primaryCategory: input.primaryCategory,
        // O principal nunca se repete entre os outros: a lista responde "o que
        // mais ela faz", e não "tudo que ela faz".
        secondaryCategories: (input.secondaryCategories ?? []).filter(
          (segmento) => segmento !== input.primaryCategory,
        ),
        workModel: input.workModel,
        currency: "BRL",
        timezone: input.timezone ?? "America/Sao_Paulo",
        // A agenda pública começa fechada; o link é criado quando ela pedir.
        bookingSlug: null,
      },
      limit,
    );

    if (!created) throw new PlanLimitError("businesses", limit as number, plan);
    return created;
  }
}

export class ListBusinesses {
  constructor(private readonly businesses: BusinessRepository) {}

  execute(ownerUserId: string): Promise<BusinessRecord[]> {
    return this.businesses.listByOwner(ownerUserId);
  }
}

export class GetBusiness {
  constructor(private readonly access: BusinessAccess) {}

  execute(userId: string, businessId: string): Promise<BusinessRecord> {
    return this.access.authorize(userId, businessId);
  }
}

export class UpdateBusiness {
  constructor(
    private readonly access: BusinessAccess,
    private readonly businesses: BusinessRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    input: Partial<CreateBusinessInput>,
  ): Promise<BusinessRecord> {
    const atual = await this.access.authorize(userId, businessId);

    // O principal nunca entra na lista dos outros — a lista responde "o que
    // mais ela faz". Quando o update não traz o principal, vale o que já está
    // gravado.
    const principal = input.primaryCategory ?? atual.primaryCategory;

    return this.businesses.update(businessId, {
      ...(input.name !== undefined ? { name: input.name?.trim() || null } : {}),
      ...(input.primaryCategory !== undefined ? { primaryCategory: input.primaryCategory } : {}),
      ...(input.workModel !== undefined ? { workModel: input.workModel } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.secondaryCategories !== undefined
        ? {
            secondaryCategories: input.secondaryCategories.filter(
              (segmento) => segmento !== principal,
            ),
          }
        : {}),
    });
  }
}

export class GetBusinessSettings {
  constructor(
    private readonly access: BusinessAccess,
    private readonly businesses: BusinessRepository,
  ) {}

  async execute(userId: string, businessId: string): Promise<BusinessSettingsRecord> {
    await this.access.authorize(userId, businessId);
    const settings = await this.businesses.getSettings(businessId);
    if (!settings) throw new NotFoundError("Configuração do negócio", "f");
    return settings;
  }
}

export type SaveSettingsInput = {
  desiredMonthlyWithdrawalCents: number;
  /** Meta de lucro mensal, além da retirada. Omitir mantém o que já existe. */
  monthlyProfitGoalCents?: number | null;
  productiveHoursPerMonth: number;
  estimatedAppointmentsPerMonth: number;
  fixedCostAllocationMethod: AllocationMethodSlug;
  roundingStrategy: RoundingStrategySlug;
};

/**
 * Configuração da hora de trabalho e do rateio, item E-03.
 *
 * É gravação idempotente porque o onboarding do documento 02 salva o progresso
 * a cada etapa e pode repetir a mesma etapa.
 */
export class SaveBusinessSettings {
  constructor(
    private readonly access: BusinessAccess,
    private readonly businesses: BusinessRepository,
  ) {}

  async execute(
    userId: string,
    businessId: string,
    input: SaveSettingsInput,
  ): Promise<BusinessSettingsRecord> {
    await this.access.authorize(userId, businessId);

    // A meta é opcional e a gravação substitui tudo: sem preservar o valor
    // anterior, salvar o expediente apagaria a meta em silêncio.
    const atual = await this.businesses.getSettings(businessId);

    return this.businesses.saveSettings({
      businessId,
      ...input,
      monthlyProfitGoalCents:
        input.monthlyProfitGoalCents !== undefined
          ? input.monthlyProfitGoalCents
          : (atual?.monthlyProfitGoalCents ?? null),
    });
  }
}
