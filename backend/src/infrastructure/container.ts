import type { Dependencies } from "../application/ports/dependencies";
import { env } from "../config/env";
import { MercadoPagoTranslator } from "./billing/mercado-pago/translator";
import { NotConfiguredGateway } from "./billing/not-configured-gateway";
import { RevenueCatTranslator } from "./billing/revenuecat/translator";
import { prisma } from "./persistence/prisma/client";
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
    clock: { now: () => new Date() },
  };
}
