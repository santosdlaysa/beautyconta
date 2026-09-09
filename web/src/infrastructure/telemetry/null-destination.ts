import type { AnalyticsDestination } from "@/application/ports/analytics";

/**
 * Destino de produção enquanto o ADR-0006 estiver em "Proposto". Descarta o
 * evento de propósito: é preferível não medir a instalar SDK de terceiro sem
 * decisão registrada, sem banner de consentimento correspondente e sem a
 * ferramenta constando na política de privacidade.
 */
export const nullDestination: AnalyticsDestination = {
  send() {},
};
