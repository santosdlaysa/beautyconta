import type { Dependencies } from "../application/ports/dependencies";
import type { Notifier } from "../application/ports/notifications";
import { env } from "../config/env";
import { MercadoPagoTranslator } from "./billing/mercado-pago/translator";
import { NotConfiguredGateway } from "./billing/not-configured-gateway";
import { RevenueCatTranslator } from "./billing/revenuecat/translator";
import { PrismaMetricsRepository } from "./persistence/prisma/metrics-repository";
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

/** Composição de produção: Prisma sobre o PostgreSQL do `DATABASE_URL`. */
export function createDependencies(): Dependencies {
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
    gateway: new NotConfiguredGateway(),
    translators: {
      "mercado-pago": new MercadoPagoTranslator(env.billing.mercadoPagoWebhookSecret),
      revenuecat: new RevenueCatTranslator(
        env.billing.revenueCatProducts,
        env.billing.revenueCatAuthorization,
        env.billing.revenueCatAcceptSandbox,
      ),
    },
    metrics: new PrismaMetricsRepository(prisma),
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
