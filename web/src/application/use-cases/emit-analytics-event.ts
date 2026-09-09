import {
  ANALYTICS_EVENTS,
  type AnalyticsDestination,
  type AnalyticsEvent,
  type AnalyticsEventName,
  type AnalyticsProperties,
} from "../ports/analytics";

/**
 * Aplica as regras invioláveis do ADR-0006 antes de qualquer envio: só nome de
 * evento do catálogo e propriedades categóricas, nunca valor financeiro nem
 * dado pessoal.
 *
 * A proteção mora aqui, e não na revisão de código, porque quem chama é uma
 * tela que lida com preço o tempo todo. Um `calculation_completed` levando o
 * preço calculado é o erro provável, não o improvável — e o tipo sozinho não
 * segura, porque o objeto pode chegar montado em tempo de execução.
 */

/** Palavras que denunciam valor financeiro ou dado pessoal no nome da propriedade. */
const FORBIDDEN_KEY =
  /(pre[çc]o|price|valor|value|amount|total|custo|cost|margem|margin|lucro|profit|receita|revenue|faturamento|taxa|fee|meta|goal|sal[áa]rio|salary|nome|name|e-?mail|telefone|phone|whatsapp|celular|cpf|cnpj)/i;

/**
 * Valor que parece dinheiro, e-mail ou telefone mesmo sob um nome inocente:
 * "R$ 171,43" em uma propriedade chamada `faixa` viola a regra do mesmo jeito.
 */
const FORBIDDEN_VALUE = /(r\$\s*\d|\d[.,]\d{2}(\D|$)|@[\w.-]+\.\w{2,}|\d{4,})/i;

const EVENT_NAMES: ReadonlySet<string> = new Set(ANALYTICS_EVENTS);

export function isKnownAnalyticsEvent(name: string): name is AnalyticsEventName {
  return EVENT_NAMES.has(name);
}

export function isForbiddenProperty(key: string, value: unknown): boolean {
  // Qualquer coisa que não seja texto ou sim/não é recusada por tipo: número é
  // o caminho direto para o preço vazar, e objeto esconde o que carrega.
  if (typeof value !== "string" && typeof value !== "boolean") return true;
  if (FORBIDDEN_KEY.test(key)) return true;
  return typeof value === "string" && FORBIDDEN_VALUE.test(value);
}

/** Devolve só o que pode ser enviado; o resto é descartado, nunca corrigido. */
export function removeForbiddenProperties(properties: Readonly<Record<string, unknown>>): AnalyticsProperties {
  const safe: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (isForbiddenProperty(key, value)) continue;
    safe[key] = value as string | boolean;
  }
  return safe;
}

export type AnalyticsEmitter = (
  name: AnalyticsEventName,
  properties?: Readonly<Record<string, unknown>>,
) => AnalyticsEvent | null;

/**
 * Devolve `null` quando nada foi enviado, para que o teste consiga distinguir
 * evento recusado de evento emitido sem propriedade.
 */
export function createAnalyticsEmitter(destination: AnalyticsDestination): AnalyticsEmitter {
  return (name, properties = {}) => {
    if (!isKnownAnalyticsEvent(name)) return null;

    const event: AnalyticsEvent = { name, properties: removeForbiddenProperties(properties) };
    // Telemetria nunca derruba a tela: falha de destino é silenciada de
    // propósito, porque a calculadora precisa responder mesmo sem medição.
    try {
      destination.send(event);
    } catch {
      return null;
    }
    return event;
  };
}
