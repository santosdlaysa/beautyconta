import type { Dependencies } from "../application/ports/dependencies";
import type { Notifier } from "../application/ports/notifications";
import { env } from "../config/env";
import { MercadoPagoTranslator } from "./billing/mercado-pago/translator";
import { MercadoPagoGateway } from "./billing/mercado-pago/gateway";
import { NotConfiguredGateway } from "./billing/not-configured-gateway";
import { RevenueCatTranslator } from "./billing/revenuecat/translator";
import { PrismaAccountDeletionRequestRepository } from "./persistence/prisma/account-deletion-request-repository";
import { PrismaAdminMetricsRepository } from "./persistence/prisma/admin-metrics-repository";
import { PrismaMetricsRepository } from "./persistence/prisma/metrics-repository";
import { PrismaPlanOfferRepository } from "./persistence/prisma/plan-offer-repository";
import { SilentNotifier } from "./notifications/silent-notifier";
import { TelegramNotifier } from "./notifications/telegram-notifier";
import { prisma } from "./persistence/prisma/client";
import { PrismaBusinessHoursRepository } from "./persistence/prisma/business-hours-repository";
import { PrismaBusinessRepository } from "./persistence/prisma/business-repository";
import { PrismaAppointmentRepository } from "./persistence/prisma/appointment-repository";
import { PrismaCalculationRepository } from "./persistence/prisma/calculation-repository";
import { PrismaEquipmentRepository } from "./persistence/prisma/equipment-repository";
import { PrismaFixedCostRepository } from "./persistence/prisma/fixed-cost-repository";
import { PrismaMaterialRepository } from "./persistence/prisma/material-repository";
import { PrismaServiceRepository } from "./persistence/prisma/service-repository";
import {
  PrismaBillingEventRepository,
  PrismaSubscriptionRepository,
} from "./persistence/prisma/subscription-repository";
import { PrismaSessionRepository } from "./persistence/prisma/session-repository";
import { PrismaUserRepository } from "./persistence/prisma/user-repository";

export type { Dependencies };

/**
 * O checkout do Mercado Pago, quando há credencial.
 *
 * Sem `MERCADO_PAGO_ACCESS_TOKEN` o gateway de espera responde que a assinatura
 * ainda não está disponível — que é a verdade. Fingir um checkout sem
 * credencial levaria a assinante a uma página que não cobra nada, e o plano
 * nunca seria concedido.
 */
function createBillingGateway(): MercadoPagoGateway | NotConfiguredGateway {
  const { mercadoPagoAccessToken, mercadoPagoReturnUrl, mercadoPagoWebhookUrl } = env.billing;
  if (!mercadoPagoAccessToken) return new NotConfiguredGateway();

  return new MercadoPagoGateway({
    accessToken: mercadoPagoAccessToken,
    returnUrl: mercadoPagoReturnUrl,
    webhookUrl: mercadoPagoWebhookUrl,
  });
}

/** Composição de produção: Prisma sobre o PostgreSQL do `DATABASE_URL`. */
export function createDependencies(): Dependencies {
  // O mesmo objeto serve de checkout e de consulta: as duas coisas falam com a
  // mesma API, com a mesma credencial.
  const gateway = createBillingGateway();

  return {
    users: new PrismaUserRepository(prisma),
    sessions: new PrismaSessionRepository(prisma),
    businesses: new PrismaBusinessRepository(prisma),
    businessHours: new PrismaBusinessHoursRepository(prisma),
    materials: new PrismaMaterialRepository(prisma),
    fixedCosts: new PrismaFixedCostRepository(prisma),
    services: new PrismaServiceRepository(prisma),
    calculations: new PrismaCalculationRepository(prisma),
    appointments: new PrismaAppointmentRepository(prisma),
    equipment: new PrismaEquipmentRepository(prisma),
    subscriptions: new PrismaSubscriptionRepository(prisma),
    billingEvents: new PrismaBillingEventRepository(prisma),
    gateway,
    translators: {
      "mercado-pago": new MercadoPagoTranslator(env.billing.mercadoPagoWebhookSecret),
      revenuecat: new RevenueCatTranslator(
        env.billing.revenueCatProducts,
        env.billing.revenueCatAuthorization,
        env.billing.revenueCatAcceptSandbox,
      ),
    },
    billingResolver: gateway instanceof MercadoPagoGateway ? gateway : null,
    metrics: new PrismaMetricsRepository(prisma),
    adminMetrics: new PrismaAdminMetricsRepository(prisma),
    planOffers: new PrismaPlanOfferRepository(prisma),
    accountDeletionRequests: new PrismaAccountDeletionRequestRepository(prisma),
    admin: env.admin,
    plans: {
      prices: env.billing.prices,
      termsUrl: env.legal.termsUrl,
      privacyUrl: env.legal.privacyUrl,
      supportEmail: env.legal.supportEmail,
    },
    notifier: createNotifier(),
    clock: { now: () => new Date() },
  };
}

/**
 * Telegram quando há token e destino; silêncio caso contrário.
 *
 * A escolha acontece uma vez, na composição, e não a cada aviso: assim nenhum
 * caso de uso precisa perguntar se a integração existe.
 */
function createNotifier(): Notifier {
  const { botToken, chatId } = env.telegram;
  if (!botToken || !chatId) return new SilentNotifier();
  return new TelegramNotifier(botToken, chatId);
}
