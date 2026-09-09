/**
 * Contrato de telemetria do item C-05.
 *
 * O ADR-0006 ainda não escolheu a ferramenta, e o backlog é explícito: "a
 * escolha da ferramenta pode esperar; a camada de emissão não". Por isso as
 * telas dependem deste contrato e de nenhum SDK — trocar o destino não deve
 * tocar em nenhum componente.
 */

/**
 * Os doze eventos da seção 8 do documento 05. É a lista inteira de propósito,
 * mesmo que a web só emita parte dela: evento novo passa por revisão contra as
 * regras do ADR-0006 antes de existir, e não é inventado na tela.
 */
export const ANALYTICS_EVENTS = [
  "calculator_viewed",
  "calculation_started",
  "calculation_completed",
  "result_explained_opened",
  "price_simulated",
  "signup_started",
  "signup_completed",
  "first_service_saved",
  "plan_limit_reached",
  "checkout_started",
  "subscription_started",
  "subscription_cancelled",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/**
 * Propriedade é categórica por decisão do ADR-0006. Número fica fora do tipo de
 * propósito: é por número que preço, custo, margem, meta e faturamento
 * vazariam. Distribuição, quando necessária, vai como faixa em texto.
 */
export type AnalyticsPropertyValue = string | boolean;

export type AnalyticsProperties = Readonly<Record<string, AnalyticsPropertyValue>>;

export type AnalyticsEvent = {
  name: AnalyticsEventName;
  properties: AnalyticsProperties;
};

export interface AnalyticsDestination {
  send(event: AnalyticsEvent): void;
}
