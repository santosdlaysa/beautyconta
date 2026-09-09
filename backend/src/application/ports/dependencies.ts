import type { BillingWebhookTranslator, SubscriptionGateway } from "./billing";
import type {
  AppointmentRepository,
  BillingEventRepository,
  BusinessHoursRepository,
  BusinessRepository,
  CalculationRepository,
  Clock,
  EquipmentRepository,
  FixedCostRepository,
  MaterialRepository,
  ServiceRepository,
  SessionRepository,
  SubscriptionRepository,
  UserRepository,
} from "./repositories";

/**
 * Tudo o que a aplicação precisa de fora, declarado como contrato.
 *
 * O tipo mora na camada de aplicação — quem depende é quem define — e a
 * infraestrutura o satisfaz. É por causa dele que a suíte monta a API inteira
 * sobre repositórios em memória e exercita as regras sem rede e sem banco.
 */
export type Dependencies = {
  users: UserRepository;
  sessions: SessionRepository;
  businesses: BusinessRepository;
  businessHours: BusinessHoursRepository;
  materials: MaterialRepository;
  fixedCosts: FixedCostRepository;
  services: ServiceRepository;
  calculations: CalculationRepository;
  appointments: AppointmentRepository;
  equipment: EquipmentRepository;
  subscriptions: SubscriptionRepository;
  billingEvents: BillingEventRepository;
  gateway: SubscriptionGateway;
  translators: Record<"mercado-pago" | "revenuecat", BillingWebhookTranslator>;
  clock: Clock;
};
