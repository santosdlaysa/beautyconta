import type {
  AppointmentRecord,
  BusinessHourRecord,
  BillingEventRecord,
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
} from "./records";

/**
 * Portas de persistência.
 *
 * Declaradas aqui, e não na infraestrutura, conforme a seção 3 do documento 12:
 * quem precisa do dado é quem define o contrato. Toda assinatura de método que
 * lê ou escreve dado de negócio carrega `businessId` — é o que torna o
 * isolamento do item B-03 uma obrigação de compilação, não de disciplina.
 */

export type Clock = { now(): Date };

export type IdGenerator = { next(): string };

export interface UserRepository {
  create(input: { name: string; email: string; passwordHash: string }): Promise<UserRecord>;
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  /** Só para conferir a senha na entrada: o hash não sobe para nenhuma outra camada. */
  findCredentialsByEmail(email: string): Promise<UserCredentialsRecord | null>;
  update(id: string, input: { name?: string }): Promise<UserRecord>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  /** Exclusão efetiva exigida por `RF-01`, em cascata nos dados do negócio. */
  delete(id: string): Promise<void>;
}

/**
 * Sessões do aplicativo.
 *
 * `tokenHash` entra e sai como resumo: o token em claro existe apenas no
 * instante da criação, dentro do caso de uso que o devolve para a usuária.
 */
export interface SessionRepository {
  create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<SessionRecord>;
  findValidByTokenHash(tokenHash: string, now: Date): Promise<SessionRecord | null>;
  touch(id: string, now: Date): Promise<void>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
}

export interface BusinessRepository {
  create(input: Omit<BusinessRecord, "id" | "createdAt" | "updatedAt">): Promise<BusinessRecord>;
  /** Como `MaterialRepository.createWithinLimit`, mas contando por dona. */
  createWithinLimit(
    input: Omit<BusinessRecord, "id" | "createdAt" | "updatedAt">,
    limit: number | null,
  ): Promise<BusinessRecord | null>;
  findById(id: string): Promise<BusinessRecord | null>;
  listByOwner(ownerUserId: string): Promise<BusinessRecord[]>;
  update(
    id: string,
    input: Partial<Pick<BusinessRecord, "name" | "primaryCategory" | "workModel" | "timezone">>,
  ): Promise<BusinessRecord>;
  /** Busca pelo endereço secreto da agenda pública, sem exigir sessão. */
  findByBookingToken(token: string): Promise<BusinessRecord | null>;
  setBookingToken(businessId: string, token: string | null): Promise<BusinessRecord>;
  getSettings(businessId: string): Promise<BusinessSettingsRecord | null>;
  saveSettings(
    input: Omit<BusinessSettingsRecord, "createdAt" | "updatedAt">,
  ): Promise<BusinessSettingsRecord>;
}

export interface MaterialRepository {
  create(input: Omit<MaterialRecord, "id" | "createdAt" | "updatedAt">): Promise<MaterialRecord>;
/**
 * Criação com o teto do plano conferido dentro da mesma transação.
 *
 * Contar antes e inserir depois deixa uma janela entre as duas operações: vinte
 * requisições paralelas leem a mesma contagem, todas passam pela verificação e
 * todas inserem. O limite do plano vira decoração. Devolve `null` quando o teto
 * já foi atingido — traduzir isso em erro é papel da aplicação, não do banco.
 */
  createWithinLimit(
    input: Omit<MaterialRecord, "id" | "createdAt" | "updatedAt">,
    limit: number | null,
  ): Promise<MaterialRecord | null>;
  findById(businessId: string, id: string): Promise<MaterialRecord | null>;
  findManyByIds(businessId: string, ids: readonly string[]): Promise<MaterialRecord[]>;
  list(businessId: string, options?: { includeArchived?: boolean }): Promise<MaterialRecord[]>;
  count(businessId: string): Promise<number>;
  update(
    businessId: string,
    id: string,
    input: Partial<Omit<MaterialRecord, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<MaterialRecord>;
  /** Remove de vez; só é permitido quando nenhum serviço usa o material. */
  delete(businessId: string, id: string): Promise<void>;
  isUsedByService(businessId: string, id: string): Promise<boolean>;
}

export interface FixedCostRepository {
  create(input: Omit<FixedCostRecord, "id" | "createdAt" | "updatedAt">): Promise<FixedCostRecord>;
  /** Ver `MaterialRepository.createWithinLimit`. */
  createWithinLimit(
    input: Omit<FixedCostRecord, "id" | "createdAt" | "updatedAt">,
    limit: number | null,
  ): Promise<FixedCostRecord | null>;
  findById(businessId: string, id: string): Promise<FixedCostRecord | null>;
  list(businessId: string, options?: { includeInactive?: boolean }): Promise<FixedCostRecord[]>;
  count(businessId: string): Promise<number>;
  /** Soma dos ativos, em centavos: é o `CF` mensal das fórmulas do documento 03. */
  monthlyTotalCents(businessId: string): Promise<number>;
  update(
    businessId: string,
    id: string,
    input: Partial<Omit<FixedCostRecord, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<FixedCostRecord>;
  delete(businessId: string, id: string): Promise<void>;
}

export type ServiceInput = Omit<ServiceRecord, "id" | "createdAt" | "updatedAt">;

export interface ServiceRepository {
  create(input: ServiceInput): Promise<ServiceRecord>;
  /** Ver `MaterialRepository.createWithinLimit`. */
  createWithinLimit(input: ServiceInput, limit: number | null): Promise<ServiceRecord | null>;
  findById(businessId: string, id: string): Promise<ServiceRecord | null>;
  list(businessId: string, options?: { includeArchived?: boolean }): Promise<ServiceRecord[]>;
  count(businessId: string): Promise<number>;
  update(
    businessId: string,
    id: string,
    input: Partial<Omit<ServiceRecord, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<ServiceRecord>;
  delete(businessId: string, id: string): Promise<void>;
}

/**
 * Expediente do negócio.
 *
 * A gravação substitui a semana inteira: é assim que a tela funciona, e um
 * expediente meio salvo geraria horário livre que não existe.
 */
export interface BusinessHoursRepository {
  list(businessId: string): Promise<BusinessHourRecord[]>;
  replaceAll(
    businessId: string,
    hours: readonly Omit<BusinessHourRecord, "id" | "businessId">[],
  ): Promise<BusinessHourRecord[]>;
}

export interface AppointmentRepository {
  create(input: Omit<AppointmentRecord, "id" | "createdAt" | "updatedAt">): Promise<AppointmentRecord>;
  findById(businessId: string, id: string): Promise<AppointmentRecord | null>;
  /** Intervalo semiaberto: inclui o início, exclui o fim. */
  listBetween(businessId: string, from: Date, to: Date): Promise<AppointmentRecord[]>;
  /**
   * Cria conferindo, na mesma transação, que o horário continua livre.
   *
   * Sem isso, duas clientes que abrem o link ao mesmo tempo escolhem o mesmo
   * horário e as duas conseguem: a lista foi montada antes, e entre ver e
   * confirmar o mundo mudou. Devolve `null` quando alguém chegou primeiro.
   */
  createIfFree(
    input: Omit<AppointmentRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<AppointmentRecord | null>;
  update(
    businessId: string,
    id: string,
    input: Partial<Omit<AppointmentRecord, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<AppointmentRecord>;
  delete(businessId: string, id: string): Promise<void>;
}

export interface CalculationRepository {
  /** Grava a fotografia. Não existe `update`: o histórico é imutável (E-05). */
  create(
    input: Omit<PricingCalculationRecord, "id" | "createdAt">,
  ): Promise<PricingCalculationRecord>;
  findById(businessId: string, id: string): Promise<PricingCalculationRecord | null>;
  list(
    businessId: string,
    options?: { limit?: number | null; serviceId?: string },
  ): Promise<PricingCalculationRecord[]>;
  count(businessId: string): Promise<number>;
  /** Se algum cálculo do histórico aponta para este serviço. */
  existsForService(businessId: string, serviceId: string): Promise<boolean>;
}

export interface EquipmentRepository {
  create(input: Omit<EquipmentRecord, "id" | "createdAt" | "updatedAt">): Promise<EquipmentRecord>;
  findById(businessId: string, id: string): Promise<EquipmentRecord | null>;
  list(businessId: string, options?: { includeArchived?: boolean }): Promise<EquipmentRecord[]>;
  update(
    businessId: string,
    id: string,
    input: Partial<Omit<EquipmentRecord, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<EquipmentRecord>;
  delete(businessId: string, id: string): Promise<void>;
}

export interface SubscriptionRepository {
  listByBusiness(businessId: string): Promise<SubscriptionRecord[]>;
  findByProviderSubscriptionId(
    provider: SubscriptionRecord["provider"],
    providerSubscriptionId: string,
  ): Promise<SubscriptionRecord | null>;
  upsertByProviderSubscriptionId(
    input: Omit<SubscriptionRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<SubscriptionRecord>;
  update(
    id: string,
    input: Partial<Omit<SubscriptionRecord, "id" | "businessId" | "createdAt" | "updatedAt">>,
  ): Promise<SubscriptionRecord>;
}

export interface BillingEventRepository {
  /**
   * Grava o evento bruto antes de qualquer processamento. Devolve `null` quando
   * `externalEventId` já existe — é assim que a idempotência exigida pela seção
   * 3 do documento 11 é resolvida no banco, e não com verificação em memória.
   */
  recordIfNew(
    input: Omit<BillingEventRecord, "id" | "createdAt" | "processedAt">,
  ): Promise<BillingEventRecord | null>;
  /**
   * Evento já gravado, para decidir entre ignorar a reentrega e retomar de onde
   * parou. Sem isso, uma falha entre gravar e processar deixaria o evento preso
   * para sempre: o provedor reenviaria, receberia "duplicado" e desistiria.
   */
  findByExternalEventId(
    source: BillingEventRecord["source"],
    externalEventId: string,
  ): Promise<BillingEventRecord | null>;
  markProcessed(id: string, processedAt: Date): Promise<void>;
}
