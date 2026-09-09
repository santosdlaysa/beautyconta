import { DomainError } from "../shared/domain-error";

export type PlanSlug = "FREE" | "PREMIUM" | "MASTER";

export type LimitedResource =
  | "businesses"
  | "materials"
  | "services"
  | "fixedCosts"
  | "calculations";

/**
 * Limites do plano gratuito, seção 6 do documento 01 e item F-01 do backlog.
 * `null` significa sem limite. Estes números vivem no domínio porque a
 * verificação acontece no servidor, nunca apenas na interface.
 */
export const PLAN_LIMITS: Record<PlanSlug, Record<LimitedResource, number | null>> = {
  // `businesses` não está na tabela do documento 01 porque a jornada pressupõe
  // um negócio por pessoa. Sem o teto, porém, os outros limites viram enfeite:
  // bastava criar um negócio novo para ganhar mais dez materiais.
  FREE: { businesses: 1, materials: 10, services: 3, fixedCosts: 5, calculations: 5 },
  PREMIUM: {
    businesses: 5,
    materials: null,
    services: null,
    fixedCosts: null,
    calculations: null,
  },
  MASTER: {
    businesses: 5,
    materials: null,
    services: null,
    fixedCosts: null,
    calculations: null,
  },
};

/** Singular e plural, porque "permite 1 negócios" é texto que a usuária lê. */
const RESOURCE_LABELS: Record<LimitedResource, { um: string; varios: string }> = {
  businesses: { um: "negócio", varios: "negócios" },
  materials: { um: "material", varios: "materiais" },
  services: { um: "serviço", varios: "serviços" },
  fixedCosts: { um: "custo fixo", varios: "custos fixos" },
  calculations: { um: "cálculo no histórico", varios: "cálculos no histórico" },
};

/**
 * Erro de limite de plano. Separado de `DomainError` porque a resposta não é
 * "você errou o dado": nada está inválido, o plano é que acabou. A mensagem diz
 * o que muda ao assinar, e nenhum dado já cadastrado é apagado — critério
 * explícito do item F-01.
 */
export class PlanLimitError extends DomainError {
  constructor(
    readonly resource: LimitedResource,
    readonly limit: number,
    readonly plan: PlanSlug,
  ) {
    super(mensagemDoLimite(resource, limit, plan));
    this.name = "PlanLimitError";
  }
}

/**
 * A mensagem chega à interface como está, então precisa ser verdadeira: só
 * promete "sem limite" quando o plano pago realmente não tem teto para aquele
 * recurso. Negócios têm teto nos três planos.
 */
function mensagemDoLimite(
  resource: LimitedResource,
  limit: number,
  plan: PlanSlug,
): string {
  const rotulo = RESOURCE_LABELS[resource];
  const quantidade = `${limit} ${limit === 1 ? rotulo.um : rotulo.varios}`;
  const naoPerdeNada = "Nada do que você já salvou é perdido.";

  if (plan !== "FREE") {
    return `Seu plano permite ${quantidade}. ${naoPerdeNada}`;
  }

  const ilimitadoNoPago = PLAN_LIMITS.PREMIUM[resource] === null;

  return ilimitadoNoPago
    ? `Seu plano atual permite ${quantidade}. Ao assinar, o cadastro fica sem limite. ${naoPerdeNada}`
    : `Seu plano atual permite ${quantidade}. ${naoPerdeNada}`;
}

export function limitFor(plan: PlanSlug, resource: LimitedResource): number | null {
  return PLAN_LIMITS[plan][resource];
}

/** Chamada antes de criar o registro; `currentCount` é o que já existe. */
export function assertCanAdd(
  plan: PlanSlug,
  resource: LimitedResource,
  currentCount: number,
): void {
  const limit = limitFor(plan, resource);
  if (limit !== null && currentCount >= limit) {
    throw new PlanLimitError(resource, limit, plan);
  }
}

/**
 * Quantos cálculos o histórico mostra. O plano gratuito vê os cinco últimos; o
 * registro antigo continua no banco, apenas não é listado, porque o item F-01
 * proíbe apagar dado ao atingir limite.
 */
export function historyWindow(plan: PlanSlug): number | null {
  return limitFor(plan, "calculations");
}
