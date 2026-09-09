import { randomUUID } from "node:crypto";
import type {
  BillingEventTranslation,
  BillingWebhookTranslator,
  CheckoutRequest,
  CheckoutSession,
  SubscriptionGateway,
} from "../../src/application/ports/billing";
import type { Dependencies } from "../../src/application/ports/dependencies";
import type {
  AppointmentRepository,
  BillingEventRepository,
  BusinessHoursRepository,
  BusinessRepository,
  CalculationRepository,
  EquipmentRepository,
  FixedCostRepository,
  MaterialRepository,
  ServiceInput,
  ServiceRepository,
  SessionRepository,
  SubscriptionRepository,
  UserRepository,
} from "../../src/application/ports/repositories";
import type {
  AppointmentRecord,
  BillingEventRecord,
  BusinessHourRecord,
  BusinessRecord,
  BusinessSettingsRecord,
  EquipmentRecord,
  FixedCostRecord,
  MaterialRecord,
  PricingCalculationRecord,
  ServiceRecord,
  SessionRecord,
  SubscriptionRecord,
  UserCredentialsRecord,
  UserRecord,
} from "../../src/application/ports/records";

/**
 * Repositórios em memória.
 *
 * Existem para que a suíte exercite a API inteira — rotas, guardas, limites de
 * plano e imutabilidade do histórico — sem rede e sem banco. Eles imitam as
 * duas garantias que importam do PostgreSQL: filtro por `businessId` em toda
 * leitura e unicidade de `externalEventId` na gravação de evento de cobrança.
 */

const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryUserRepository implements UserRepository {
  readonly items = new Map<string, UserRecord>();
  /** Fora de `items` porque o hash não pertence ao registro que circula. */
  private readonly hashes = new Map<string, string | null>();

  create(input: { name: string; email: string; passwordHash: string }): Promise<UserRecord> {
    const now = new Date();
    const user: UserRecord = {
      id: randomUUID(),
      name: input.name,
      email: input.email,
      emailVerifiedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.items.set(user.id, user);
    this.hashes.set(user.id, input.passwordHash);
    return Promise.resolve(clone(user));
  }

  findCredentialsByEmail(email: string): Promise<UserCredentialsRecord | null> {
    const user = [...this.items.values()].find((item) => item.email === email);
    if (!user) return Promise.resolve(null);
    return Promise.resolve({
      id: user.id,
      passwordHash: this.hashes.get(user.id) ?? null,
      deletedAt: user.deletedAt,
    });
  }

  updatePassword(id: string, passwordHash: string): Promise<void> {
    this.hashes.set(id, passwordHash);
    return Promise.resolve();
  }

  findById(id: string): Promise<UserRecord | null> {
    const user = this.items.get(id);
    return Promise.resolve(user ? clone(user) : null);
  }

  findByEmail(email: string): Promise<UserRecord | null> {
    const user = [...this.items.values()].find((item) => item.email === email);
    return Promise.resolve(user ? clone(user) : null);
  }

  update(id: string, input: { name?: string }): Promise<UserRecord> {
    const user = this.items.get(id);
    if (!user) throw new Error("Usuária inexistente.");
    const updated = { ...user, ...input, updatedAt: new Date() };
    this.items.set(id, updated);
    return Promise.resolve(clone(updated));
  }

  delete(id: string): Promise<void> {
    this.items.delete(id);
    return Promise.resolve();
  }
}

/**
 * Sessões em memória. Guarda o mesmo resumo que o banco guardaria, para que a
 * suíte exercite o caminho real do token e não uma versão simplificada dele.
 */
export class InMemorySessionRepository implements SessionRepository {
  readonly items = new Map<string, SessionRecord & { tokenHash: string }>();

  create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<SessionRecord> {
    const session = {
      id: randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
    };
    this.items.set(session.id, session);
    return Promise.resolve(clone(session));
  }

  findValidByTokenHash(tokenHash: string, now: Date): Promise<SessionRecord | null> {
    const session = [...this.items.values()].find(
      (item) => item.tokenHash === tokenHash && item.expiresAt > now,
    );
    return Promise.resolve(session ? clone(session) : null);
  }

  touch(): Promise<void> {
    return Promise.resolve();
  }

  deleteByTokenHash(tokenHash: string): Promise<void> {
    for (const [id, item] of this.items) {
      if (item.tokenHash === tokenHash) this.items.delete(id);
    }
    return Promise.resolve();
  }

  deleteAllForUser(userId: string): Promise<void> {
    for (const [id, item] of this.items) {
      if (item.userId === userId) this.items.delete(id);
    }
    return Promise.resolve();
  }
}

export class InMemoryBusinessRepository implements BusinessRepository {
  readonly items = new Map<string, BusinessRecord>();
  readonly settings = new Map<string, BusinessSettingsRecord>();


  /**
   * Nos fakes a contagem e a inserção já são atômicas: nada roda entre elas
   * porque não há `await` de verdade no meio. Isso significa que a corrida que
   * a versão do Prisma resolve **não é reproduzível aqui** — quem garante a
   * atomicidade é o isolamento `Serializable` do PostgreSQL, e é lá que a
   * garantia precisa ser verificada.
   */
  async createWithinLimit(
    input: Omit<BusinessRecord, "id" | "createdAt" | "updatedAt">,
    limit: number | null,
  ): Promise<BusinessRecord | null> {
    const atuais = [...this.items.values()].filter(
      (item) => item.ownerUserId === input.ownerUserId,
    ).length;
    if (limit !== null && atuais >= limit) return null;
    return this.create(input);
  }

  create(input: Omit<BusinessRecord, "id" | "createdAt" | "updatedAt">): Promise<BusinessRecord> {
    const now = new Date();
    const business: BusinessRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    this.items.set(business.id, business);
    return Promise.resolve(clone(business));
  }

  findById(id: string): Promise<BusinessRecord | null> {
    const business = this.items.get(id);
    return Promise.resolve(business ? clone(business) : null);
  }

  findByBookingToken(token: string): Promise<BusinessRecord | null> {
    const business = [...this.items.values()].find((item) => item.bookingToken === token);
    return Promise.resolve(business ? clone(business) : null);
  }

  setBookingToken(businessId: string, token: string | null): Promise<BusinessRecord> {
    const business = this.items.get(businessId);
    if (!business) throw new Error("Negócio inexistente.");
    const updated = { ...business, bookingToken: token, updatedAt: new Date() };
    this.items.set(businessId, updated);
    return Promise.resolve(clone(updated));
  }

  listByOwner(ownerUserId: string): Promise<BusinessRecord[]> {
    return Promise.resolve(
      [...this.items.values()].filter((item) => item.ownerUserId === ownerUserId).map(clone),
    );
  }

  update(
    id: string,
    input: Partial<Pick<BusinessRecord, "name" | "primaryCategory" | "workModel" | "timezone">>,
  ): Promise<BusinessRecord> {
    const business = this.items.get(id);
    if (!business) throw new Error("Negócio inexistente.");
    const updated = { ...business, ...input, updatedAt: new Date() };
    this.items.set(id, updated);
    return Promise.resolve(clone(updated));
  }

  getSettings(businessId: string): Promise<BusinessSettingsRecord | null> {
    const settings = this.settings.get(businessId);
    return Promise.resolve(settings ? clone(settings) : null);
  }

  saveSettings(
    input: Omit<BusinessSettingsRecord, "createdAt" | "updatedAt">,
  ): Promise<BusinessSettingsRecord> {
    const existing = this.settings.get(input.businessId);
    const now = new Date();
    const saved: BusinessSettingsRecord = {
      ...input,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.settings.set(input.businessId, saved);
    return Promise.resolve(clone(saved));
  }
}

export class InMemoryMaterialRepository implements MaterialRepository {
  readonly items = new Map<string, MaterialRecord>();

  async createWithinLimit(
    input: Omit<MaterialRecord, "id" | "createdAt" | "updatedAt">,
    limit: number | null,
  ): Promise<MaterialRecord | null> {
    if (limit !== null && (await this.count(input.businessId)) >= limit) return null;
    return this.create(input);
  }

  create(input: Omit<MaterialRecord, "id" | "createdAt" | "updatedAt">): Promise<MaterialRecord> {
    const now = new Date();
    const material: MaterialRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    this.items.set(material.id, material);
    return Promise.resolve(clone(material));
  }

  findById(businessId: string, id: string): Promise<MaterialRecord | null> {
    const material = this.items.get(id);
    return Promise.resolve(
      material && material.businessId === businessId ? clone(material) : null,
    );
  }

  findManyByIds(businessId: string, ids: readonly string[]): Promise<MaterialRecord[]> {
    return Promise.resolve(
      ids
        .map((id) => this.items.get(id))
        .filter((item): item is MaterialRecord => !!item && item.businessId === businessId)
        .map(clone),
    );
  }

  list(
    businessId: string,
    options: { includeArchived?: boolean } = {},
  ): Promise<MaterialRecord[]> {
    return Promise.resolve(
      [...this.items.values()]
        .filter(
          (item) =>
            item.businessId === businessId && (options.includeArchived || !item.isArchived),
        )
        .map(clone),
    );
  }

  count(businessId: string): Promise<number> {
    return Promise.resolve(
      [...this.items.values()].filter((item) => item.businessId === businessId).length,
    );
  }

  update(
    businessId: string,
    id: string,
    input: Partial<Omit<MaterialRecord, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<MaterialRecord> {
    const material = this.items.get(id);
    if (!material || material.businessId !== businessId) throw new Error("Material inexistente.");
    const updated = { ...material, ...input, updatedAt: new Date() };
    this.items.set(id, updated);
    return Promise.resolve(clone(updated));
  }

  delete(businessId: string, id: string): Promise<void> {
    const material = this.items.get(id);
    if (material && material.businessId === businessId) this.items.delete(id);
    return Promise.resolve();
  }

  usedBy: () => ServiceRecord[] = () => [];

  isUsedByService(businessId: string, id: string): Promise<boolean> {
    return Promise.resolve(
      this.usedBy().some(
        (service) =>
          service.businessId === businessId &&
          service.materials.some((item) => item.materialId === id),
      ),
    );
  }
}

export class InMemoryFixedCostRepository implements FixedCostRepository {
  readonly items = new Map<string, FixedCostRecord>();

  async createWithinLimit(
    input: Omit<FixedCostRecord, "id" | "createdAt" | "updatedAt">,
    limit: number | null,
  ): Promise<FixedCostRecord | null> {
    if (limit !== null && (await this.count(input.businessId)) >= limit) return null;
    return this.create(input);
  }

  create(
    input: Omit<FixedCostRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<FixedCostRecord> {
    const now = new Date();
    const record: FixedCostRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    this.items.set(record.id, record);
    return Promise.resolve(clone(record));
  }

  findById(businessId: string, id: string): Promise<FixedCostRecord | null> {
    const record = this.items.get(id);
    return Promise.resolve(record && record.businessId === businessId ? clone(record) : null);
  }

  list(
    businessId: string,
    options: { includeInactive?: boolean } = {},
  ): Promise<FixedCostRecord[]> {
    return Promise.resolve(
      [...this.items.values()]
        .filter(
          (item) => item.businessId === businessId && (options.includeInactive || item.isActive),
        )
        .map(clone),
    );
  }

  count(businessId: string): Promise<number> {
    return Promise.resolve(
      [...this.items.values()].filter((item) => item.businessId === businessId).length,
    );
  }

  monthlyTotalCents(businessId: string): Promise<number> {
    return Promise.resolve(
      [...this.items.values()]
        .filter((item) => item.businessId === businessId && item.isActive)
        .reduce((total, item) => total + item.monthlyAmountCents, 0),
    );
  }

  update(
    businessId: string,
    id: string,
    input: Partial<Omit<FixedCostRecord, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<FixedCostRecord> {
    const record = this.items.get(id);
    if (!record || record.businessId !== businessId) throw new Error("Custo fixo inexistente.");
    const updated = { ...record, ...input, updatedAt: new Date() };
    this.items.set(id, updated);
    return Promise.resolve(clone(updated));
  }

  delete(businessId: string, id: string): Promise<void> {
    const record = this.items.get(id);
    if (record && record.businessId === businessId) this.items.delete(id);
    return Promise.resolve();
  }
}

export class InMemoryServiceRepository implements ServiceRepository {
  readonly items = new Map<string, ServiceRecord>();

  async createWithinLimit(
    input: ServiceInput,
    limit: number | null,
  ): Promise<ServiceRecord | null> {
    if (limit !== null && (await this.count(input.businessId)) >= limit) return null;
    return this.create(input);
  }

  create(input: ServiceInput): Promise<ServiceRecord> {
    const now = new Date();
    const service: ServiceRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    this.items.set(service.id, service);
    return Promise.resolve(clone(service));
  }

  findById(businessId: string, id: string): Promise<ServiceRecord | null> {
    const service = this.items.get(id);
    return Promise.resolve(service && service.businessId === businessId ? clone(service) : null);
  }

  list(businessId: string, options: { includeArchived?: boolean } = {}): Promise<ServiceRecord[]> {
    return Promise.resolve(
      [...this.items.values()]
        .filter(
          (item) =>
            item.businessId === businessId && (options.includeArchived || !item.isArchived),
        )
        .map(clone),
    );
  }

  count(businessId: string): Promise<number> {
    return Promise.resolve(
      [...this.items.values()].filter((item) => item.businessId === businessId).length,
    );
  }

  update(
    businessId: string,
    id: string,
    input: Partial<Omit<ServiceRecord, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<ServiceRecord> {
    const service = this.items.get(id);
    if (!service || service.businessId !== businessId) throw new Error("Serviço inexistente.");
    const updated = { ...service, ...input, updatedAt: new Date() };
    this.items.set(id, updated);
    return Promise.resolve(clone(updated));
  }

  delete(businessId: string, id: string): Promise<void> {
    const service = this.items.get(id);
    if (service && service.businessId === businessId) this.items.delete(id);
    return Promise.resolve();
  }
}

export class InMemoryAppointmentRepository implements AppointmentRepository {
  readonly items = new Map<string, AppointmentRecord>();

  create(input: Omit<AppointmentRecord, "id" | "createdAt" | "updatedAt">): Promise<AppointmentRecord> {
    const now = new Date();
    const appointment: AppointmentRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    this.items.set(appointment.id, appointment);
    return Promise.resolve(clone(appointment));
  }

  /**
   * Confere o conflito antes de gravar, como a versão do Prisma faz dentro da
   * transação. Aqui não há corrida de verdade — nada roda entre a conferência e
   * a gravação —, então o que este fake cobre é a **regra**, não a atomicidade.
   */
  createIfFree(
    input: Omit<AppointmentRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<AppointmentRecord | null> {
    const fim = new Date(input.startsAt.getTime() + input.durationMinutes * 60_000);

    const colide = [...this.items.values()].some((item) => {
      if (item.businessId !== input.businessId) return false;
      if (item.status === "CANCELED" || item.status === "NO_SHOW") return false;

      const fimExistente = new Date(item.startsAt.getTime() + item.durationMinutes * 60_000);
      return input.startsAt < fimExistente && fim > item.startsAt;
    });

    return colide ? Promise.resolve(null) : this.create(input);
  }

  findById(businessId: string, id: string): Promise<AppointmentRecord | null> {
    const appointment = this.items.get(id);
    return Promise.resolve(
      appointment && appointment.businessId === businessId ? clone(appointment) : null,
    );
  }

  listBetween(businessId: string, from: Date, to: Date): Promise<AppointmentRecord[]> {
    const items = [...this.items.values()]
      .filter((item) => item.businessId === businessId && item.startsAt >= from && item.startsAt < to)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    return Promise.resolve(items.map(clone));
  }

  update(
    businessId: string,
    id: string,
    input: Partial<Omit<AppointmentRecord, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<AppointmentRecord> {
    const appointment = this.items.get(id);
    if (!appointment || appointment.businessId !== businessId) {
      throw new Error("Atendimento inexistente.");
    }
    const updated = { ...appointment, ...input, updatedAt: new Date() };
    this.items.set(id, updated);
    return Promise.resolve(clone(updated));
  }

  delete(businessId: string, id: string): Promise<void> {
    const appointment = this.items.get(id);
    if (appointment && appointment.businessId === businessId) this.items.delete(id);
    return Promise.resolve();
  }
}

export class InMemoryCalculationRepository implements CalculationRepository {
  readonly items: PricingCalculationRecord[] = [];

  create(
    input: Omit<PricingCalculationRecord, "id" | "createdAt">,
  ): Promise<PricingCalculationRecord> {
    const record: PricingCalculationRecord = {
      ...input,
      id: randomUUID(),
      createdAt: new Date(Date.now() + this.items.length),
    };
    this.items.push(record);
    return Promise.resolve(clone(record));
  }

  findById(businessId: string, id: string): Promise<PricingCalculationRecord | null> {
    const record = this.items.find((item) => item.id === id && item.businessId === businessId);
    return Promise.resolve(record ? clone(record) : null);
  }

  list(
    businessId: string,
    options: { limit?: number | null; serviceId?: string } = {},
  ): Promise<PricingCalculationRecord[]> {
    const found = this.items
      .filter(
        (item) =>
          item.businessId === businessId &&
          (options.serviceId === undefined || item.serviceId === options.serviceId),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return Promise.resolve((options.limit ? found.slice(0, options.limit) : found).map(clone));
  }

  count(businessId: string): Promise<number> {
    return Promise.resolve(this.items.filter((item) => item.businessId === businessId).length);
  }

  existsForService(businessId: string, serviceId: string): Promise<boolean> {
    return Promise.resolve(
      this.items.some((item) => item.businessId === businessId && item.serviceId === serviceId),
    );
  }
}

export class InMemoryEquipmentRepository implements EquipmentRepository {
  readonly items = new Map<string, EquipmentRecord>();

  create(
    input: Omit<EquipmentRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<EquipmentRecord> {
    const now = new Date();
    const record: EquipmentRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    this.items.set(record.id, record);
    return Promise.resolve(clone(record));
  }

  findById(businessId: string, id: string): Promise<EquipmentRecord | null> {
    const record = this.items.get(id);
    return Promise.resolve(record && record.businessId === businessId ? clone(record) : null);
  }

  list(
    businessId: string,
    options: { includeArchived?: boolean } = {},
  ): Promise<EquipmentRecord[]> {
    return Promise.resolve(
      [...this.items.values()]
        .filter(
          (item) =>
            item.businessId === businessId && (options.includeArchived || !item.isArchived),
        )
        .map(clone),
    );
  }

  update(
    businessId: string,
    id: string,
    input: Partial<Omit<EquipmentRecord, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<EquipmentRecord> {
    const record = this.items.get(id);
    if (!record || record.businessId !== businessId) throw new Error("Equipamento inexistente.");
    const updated = { ...record, ...input, updatedAt: new Date() };
    this.items.set(id, updated);
    return Promise.resolve(clone(updated));
  }

  delete(businessId: string, id: string): Promise<void> {
    const record = this.items.get(id);
    if (record && record.businessId === businessId) this.items.delete(id);
    return Promise.resolve();
  }
}

export class InMemoryBusinessHoursRepository implements BusinessHoursRepository {
  readonly items: BusinessHourRecord[] = [];

  list(businessId: string): Promise<BusinessHourRecord[]> {
    return Promise.resolve(
      this.items
        .filter((item) => item.businessId === businessId)
        .sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute)
        .map(clone),
    );
  }

  replaceAll(
    businessId: string,
    hours: readonly Omit<BusinessHourRecord, "id" | "businessId">[],
  ): Promise<BusinessHourRecord[]> {
    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      if (this.items[i]?.businessId === businessId) this.items.splice(i, 1);
    }
    for (const hour of hours) {
      this.items.push({ ...hour, id: randomUUID(), businessId });
    }
    return this.list(businessId);
  }
}

export class InMemorySubscriptionRepository implements SubscriptionRepository {
  readonly items = new Map<string, SubscriptionRecord>();

  listByBusiness(businessId: string): Promise<SubscriptionRecord[]> {
    return Promise.resolve(
      [...this.items.values()].filter((item) => item.businessId === businessId).map(clone),
    );
  }

  findByProviderSubscriptionId(
    provider: SubscriptionRecord["provider"],
    providerSubscriptionId: string,
  ): Promise<SubscriptionRecord | null> {
    const found = [...this.items.values()].find(
      (item) =>
        item.provider === provider && item.providerSubscriptionId === providerSubscriptionId,
    );
    return Promise.resolve(found ? clone(found) : null);
  }

  upsertByProviderSubscriptionId(
    input: Omit<SubscriptionRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<SubscriptionRecord> {
    const existing = [...this.items.values()].find(
      (item) =>
        item.provider === input.provider &&
        item.providerSubscriptionId === input.providerSubscriptionId,
    );
    const now = new Date();
    const record: SubscriptionRecord = {
      ...input,
      id: existing?.id ?? randomUUID(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.items.set(record.id, record);
    return Promise.resolve(clone(record));
  }

  update(
    id: string,
    input: Partial<Omit<SubscriptionRecord, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<SubscriptionRecord> {
    const record = this.items.get(id);
    if (!record) throw new Error("Assinatura inexistente.");
    const updated = { ...record, ...input, updatedAt: new Date() };
    this.items.set(id, updated);
    return Promise.resolve(clone(updated));
  }

  /** Atalho de teste: instala uma assinatura ativa sem passar por webhook. */
  seedActive(businessId: string, plan: "PREMIUM" | "MASTER"): SubscriptionRecord {
    const now = new Date();
    const record: SubscriptionRecord = {
      id: randomUUID(),
      businessId,
      plan,
      status: "active",
      channel: "WEB",
      provider: "MERCADO_PAGO",
      billingPeriod: "MONTHLY",
      providerCustomerId: null,
      providerSubscriptionId: `seed-${randomUUID()}`,
      revenuecatAppUserId: null,
      mpPreapprovalId: null,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 3600 * 1000),
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(record.id, record);
    return record;
  }
}

export class InMemoryBillingEventRepository implements BillingEventRepository {
  readonly items = new Map<string, BillingEventRecord>();

  /** A unicidade de `externalEventId` imita o índice único do banco. */
  recordIfNew(
    input: Omit<BillingEventRecord, "id" | "createdAt" | "processedAt">,
  ): Promise<BillingEventRecord | null> {
    const duplicated = [...this.items.values()].some(
      (item) => item.externalEventId === input.externalEventId,
    );
    if (duplicated) return Promise.resolve(null);

    const record: BillingEventRecord = {
      ...input,
      id: randomUUID(),
      processedAt: null,
      createdAt: new Date(),
    };
    this.items.set(record.id, record);
    return Promise.resolve(clone(record));
  }

  findByExternalEventId(
    source: BillingEventRecord["source"],
    externalEventId: string,
  ): Promise<BillingEventRecord | null> {
    const found = [...this.items.values()].find(
      (item) => item.source === source && item.externalEventId === externalEventId,
    );
    return Promise.resolve(found ? clone(found) : null);
  }

  markProcessed(id: string, processedAt: Date): Promise<void> {
    const record = this.items.get(id);
    if (record) this.items.set(id, { ...record, processedAt });
    return Promise.resolve();
  }
}

/** Gateway de teste: registra o que foi pedido e devolve um endereço fictício. */
export class FakeGateway implements SubscriptionGateway {
  readonly provider = "MERCADO_PAGO" as const;
  readonly channel = "WEB" as const;
  readonly checkouts: CheckoutRequest[] = [];
  readonly canceled: string[] = [];

  createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    this.checkouts.push(request);
    return Promise.resolve({
      provider: this.provider,
      channel: this.channel,
      checkoutUrl: `https://checkout.exemplo/${request.businessId}`,
      providerSubscriptionId: `pre-${request.businessId}`,
    });
  }

  cancel(providerSubscriptionId: string): Promise<void> {
    this.canceled.push(providerSubscriptionId);
    return Promise.resolve();
  }
}

/**
 * Tradutor de teste: aceita o payload já no formato interno.
 *
 * As datas chegam como texto, porque o corpo veio de JSON, e são convertidas
 * para `Date` aqui — o mesmo que os tradutores reais fazem. A porta promete
 * `Date`, e um fake que devolvesse texto esconderia o erro em vez de encontrá-lo.
 */
export class PassthroughTranslator implements BillingWebhookTranslator {
  constructor(readonly provider: "MERCADO_PAGO" | "REVENUECAT" = "MERCADO_PAGO") {}

  translate(payload: unknown): BillingEventTranslation | null {
    const body = payload as Partial<BillingEventTranslation> | null;
    if (!body || typeof body.externalEventId !== "string") return null;

    const subscription = body.subscription
      ? {
          ...body.subscription,
          currentPeriodStart: toDate(body.subscription.currentPeriodStart),
          currentPeriodEnd: toDate(body.subscription.currentPeriodEnd),
        }
      : null;

    return {
      externalEventId: body.externalEventId,
      type: body.type ?? "test",
      businessId: body.businessId ?? null,
      subscription,
    };
  }
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  return null;
}

export type TestDependencies = Dependencies & {
  users: InMemoryUserRepository;
  businesses: InMemoryBusinessRepository;
  businessHours: InMemoryBusinessHoursRepository;
  sessions: InMemorySessionRepository;
  materials: InMemoryMaterialRepository;
  fixedCosts: InMemoryFixedCostRepository;
  services: InMemoryServiceRepository;
  calculations: InMemoryCalculationRepository;
  appointments: InMemoryAppointmentRepository;
  equipment: InMemoryEquipmentRepository;
  subscriptions: InMemorySubscriptionRepository;
  billingEvents: InMemoryBillingEventRepository;
  gateway: FakeGateway;
};

export function createTestDependencies(): TestDependencies {
  const materials = new InMemoryMaterialRepository();
  const services = new InMemoryServiceRepository();

  // Espelha a consulta que o Prisma faz por junção, para que a recusa de
  // exclusão de material em uso seja exercitada de verdade.
  materials.usedBy = () => [...services.items.values()];

  const translator = new PassthroughTranslator();

  return {
    users: new InMemoryUserRepository(),
    sessions: new InMemorySessionRepository(),
    businesses: new InMemoryBusinessRepository(),
    businessHours: new InMemoryBusinessHoursRepository(),
    materials,
    fixedCosts: new InMemoryFixedCostRepository(),
    services,
    calculations: new InMemoryCalculationRepository(),
    appointments: new InMemoryAppointmentRepository(),
    equipment: new InMemoryEquipmentRepository(),
    subscriptions: new InMemorySubscriptionRepository(),
    billingEvents: new InMemoryBillingEventRepository(),
    gateway: new FakeGateway(),
    translators: { "mercado-pago": translator, revenuecat: translator },
    clock: { now: () => new Date() },
  };
}
