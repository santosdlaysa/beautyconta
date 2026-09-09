import type {
  BusinessRepository,
  CalculationRepository,
  Clock,
  EquipmentRepository,
  FixedCostRepository,
  MaterialRepository,
  ServiceRepository,
  SubscriptionRepository,
} from "../ports/repositories";
import type {
  BusinessRecord,
  BusinessSettingsRecord,
  EquipmentRecord,
  FixedCostRecord,
  MaterialRecord,
  PricingCalculationRecord,
  ServiceRecord,
  SubscriptionRecord,
} from "../ports/records";
import type { BusinessAccess } from "../services/business-access";

export type BusinessExport = {
  exportedAt: Date;
  business: BusinessRecord;
  settings: BusinessSettingsRecord | null;
  materials: MaterialRecord[];
  fixedCosts: FixedCostRecord[];
  services: ServiceRecord[];
  calculations: PricingCalculationRecord[];
  equipment: EquipmentRecord[];
  subscriptions: SubscriptionRecord[];
};

/**
 * Exportação dos dados do negócio, exigida por `RF-12` e pelo item G-01.
 *
 * Leva tudo, e não a janela do plano: o limite do gratuito é de visualização no
 * histórico, e negar à pessoa a cópia do que é dela por causa de plano seria
 * usar a lei de proteção de dados como alavanca de venda.
 *
 * Arquivados e inativos também vão junto — quem exporta quer o que tem, não o
 * que a interface mostra hoje.
 */
export class ExportBusinessData {
  constructor(
    private readonly access: BusinessAccess,
    private readonly businesses: BusinessRepository,
    private readonly materials: MaterialRepository,
    private readonly fixedCosts: FixedCostRepository,
    private readonly services: ServiceRepository,
    private readonly calculations: CalculationRepository,
    private readonly equipment: EquipmentRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(userId: string, businessId: string): Promise<BusinessExport> {
    const business = await this.access.authorize(userId, businessId);

    const [settings, materials, fixedCosts, services, calculations, equipment, subscriptions] =
      await Promise.all([
        this.businesses.getSettings(businessId),
        this.materials.list(businessId, { includeArchived: true }),
        this.fixedCosts.list(businessId, { includeInactive: true }),
        this.services.list(businessId, { includeArchived: true }),
        this.calculations.list(businessId, { limit: null }),
        this.equipment.list(businessId, { includeArchived: true }),
        this.subscriptions.listByBusiness(businessId),
      ]);

    return {
      exportedAt: this.clock.now(),
      business,
      settings,
      materials,
      fixedCosts,
      services,
      calculations,
      equipment,
      subscriptions,
    };
  }
}
