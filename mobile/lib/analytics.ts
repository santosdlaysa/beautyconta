/**
 * Camada de emissão de eventos (item C-05).
 *
 * O ADR-0006 ainda não escolheu a ferramenta de analytics, e o backlog é
 * explícito: a escolha pode esperar, a camada não. Por isso aqui não há SDK
 * nenhum — só o vocabulário dos doze eventos da seção 8 do documento 05 e um
 * destino trocável. Quando o ADR fechar, troca-se o destino em um lugar só e
 * nenhuma tela precisa ser tocada.
 *
 * A regra que este arquivo faz valer: **nenhum evento carrega valor
 * financeiro, nome, e-mail ou telefone**. A proteção vive no código, não na
 * disciplina de quem escreve a chamada — a propriedade proibida é removida
 * antes de chegar ao destino, e `analytics.test.ts` falha se ela passar.
 *
 * Este arquivo não importa nada do React Native de propósito: assim o teste
 * roda em Node puro, sem simulador.
 */

/** Os doze eventos do funil. Nome fora desta lista não é emitido. */
export const EVENT_NAMES = [
  'calculator_viewed',
  'calculation_started',
  'calculation_completed',
  'result_explained_opened',
  'price_simulated',
  'signup_started',
  'signup_completed',
  'first_service_saved',
  'plan_limit_reached',
  'checkout_started',
  'subscription_started',
  'subscription_cancelled',
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

/** O que uma tela pode tentar mandar; o que passa é decidido pelo filtro. */
export type EventProperties = Record<string, unknown>;
/** O que de fato sai daqui: rótulos curtos e contagens pequenas. */
export type SafeProperties = Record<string, string | number | boolean>;

export type AnalyticsEvent = {
  name: EventName;
  properties: SafeProperties;
  /** Momento da emissão, em UTC. Não identifica ninguém. */
  at: string;
};

export type AnalyticsDestination = (event: AnalyticsEvent) => void;

/**
 * Chave que denuncia dinheiro ou pessoa.
 *
 * A lista é generosa de propósito e cobre os dois idiomas do código: é melhor
 * descartar uma propriedade inocente do que deixar escapar o preço de um
 * serviço ou o nome de uma cliente.
 */
const FORBIDDEN_KEY =
  /(pre[cç]o|price|valor|value|amount|cents|centavos|money|total|custo|cost|lucro|profit|margem|margin|receita|revenue|faturamento|ticket|retirada|withdrawal|sal[aá]rio|salary|meta|goal|nome|name|e-?mail|telefone|phone|celular|whats|cpf|cnpj|endere[cç]o|address|documento|nascimento|birth)/i;

/** Rótulo aceitável: um identificador curto, nunca um texto que a usuária digitou. */
const LABEL = /^[a-z0-9_.:-]{1,32}$/i;

/**
 * Teto das contagens.
 *
 * Um número de evento serve para contar etapa, posição ou quantidade de itens.
 * Dinheiro em centavos e em reais é quase sempre grande ou quebrado, então
 * recusar o que não é inteiro pequeno é uma segunda barreira barata contra
 * valor financeiro que passou pelo nome da chave.
 */
const MAX_COUNT = 1000;

/** Uma propriedade só passa se for rótulo curto, contagem pequena ou booleano. */
function isSafeValue(value: unknown): value is string | number | boolean {
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && value < MAX_COUNT;
  }
  if (typeof value === 'string') return LABEL.test(value);
  return false;
}

/**
 * Separa o que pode sair do que não pode.
 *
 * Devolve também o que foi descartado para o aviso de desenvolvimento e para o
 * teste do critério de aceite do item C-05.
 */
export function sanitizeProperties(properties: EventProperties = {}): {
  safe: SafeProperties;
  removed: string[];
} {
  const safe: SafeProperties = {};
  const removed: string[] = [];

  for (const [key, value] of Object.entries(properties)) {
    if (FORBIDDEN_KEY.test(key) || !isSafeValue(value)) {
      removed.push(key);
      continue;
    }
    safe[key] = value;
  }

  return { safe, removed };
}

/** Destino de desenvolvimento: o evento aparece no terminal do Metro. */
export const consoleDestination: AnalyticsDestination = (event) => {
  console.log(`[evento] ${event.name}`, event.properties);
};

/** Destino de produção enquanto o ADR-0006 não decide: o evento não vai a lugar nenhum. */
export const nullDestination: AnalyticsDestination = () => undefined;

let destination: AnalyticsDestination =
  process.env.NODE_ENV === 'production' ? nullDestination : consoleDestination;

/** Troca o destino. É o único ponto a mexer quando o ADR-0006 escolher a ferramenta. */
export function setAnalyticsDestination(next: AnalyticsDestination): void {
  destination = next;
}

/**
 * Emite um evento do funil.
 *
 * Nunca lança: uma falha de instrumentação não pode derrubar a tela que a
 * usuária está usando.
 */
export function track(name: EventName, properties?: EventProperties): void {
  if (!EVENT_NAMES.includes(name)) return;

  const { safe, removed } = sanitizeProperties(properties);

  if (removed.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn(
      `[evento] ${name}: ${removed.join(', ')} não ${removed.length === 1 ? 'foi enviada' : 'foram enviadas'} — evento não carrega valor financeiro nem dado pessoal.`,
    );
  }

  try {
    destination({ name, properties: safe, at: new Date().toISOString() });
  } catch {
    // Destino quebrado é problema do destino, não da usuária.
  }
}
