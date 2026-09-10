import type { PlanPrice } from "../../domain/billing/plan-offers";
import type { BillingWebhookTranslator, SubscriptionGateway } from "./billing";
import type { Notifier } from "./notifications";
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
  MetricsRepository,
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
  metrics: MetricsRepository;
  /**
   * Preço de cada oferta e os documentos que a tela de assinatura precisa
   * linkar. Chega por aqui, e não por `process.env`, conforme o ADR-0008.
   */
  plans: {
    prices: readonly PlanPrice[];
    termsUrl: string;
    privacyUrl: string;
    supportEmail: string;
  };
  /** Avisos administrativos. Silencioso quando o Telegram não está configurado. */
  notifier: Notifier;
  clock: Clock;
};
