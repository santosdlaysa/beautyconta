import type { PlanPrice } from "../../domain/billing/plan-offers";
import type {
  BillingStateResolver,
  BillingWebhookTranslator,
  SubscriptionGateway,
} from "./billing";
import type { Notifier } from "./notifications";
import type {
  AccountDeletionRequestRepository,
  AdminMetricsRepository,
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
  PlanOfferRepository,
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
  /**
   * Quem consulta o provedor quando a notificação não traz o estado.
   *
   * Nulo sem credencial: sem ela, a notificação do Mercado Pago continua sendo
   * gravada, mas não há como descobrir o que ela significa.
   */
  billingResolver: BillingStateResolver | null;
  metrics: MetricsRepository;
  /** Leituras do painel administrativo, que atravessam contas de outras pessoas. */
  adminMetrics: AdminMetricsRepository;
  /** Ofertas de assinatura, editadas pelo painel. */
  planOffers: PlanOfferRepository;
  /** Pedidos de exclusão de conta vindos do site. */
  accountDeletionRequests: AccountDeletionRequestRepository;
  /** Quem pode abrir o painel administrativo. */
  admin: AdminConfig;
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

/**
 * Quem pode abrir o painel administrativo.
 *
 * Mora na aplicação, e não no middleware que a aplica: é configuração do
 * sistema, não detalhe do transporte. Fosse o contrário, a camada de aplicação
 * dependeria da de apresentação — exatamente a inversão que o ADR-0008 proíbe.
 */
export type AdminConfig = {
  /** Segredo do painel. Nulo desliga a entrada por cabeçalho. */
  secret: string | null;
  /** E-mails que podem administrar pela própria sessão do aplicativo. */
  emails: readonly string[];
};
