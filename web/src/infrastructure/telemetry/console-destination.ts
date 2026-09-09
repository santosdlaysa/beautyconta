import type { AnalyticsDestination } from "@/application/ports/analytics";

/**
 * Destino de desenvolvimento. Enquanto o ADR-0006 não escolhe a ferramenta, o
 * console é o que permite conferir cada evento contra as regras de privacidade
 * antes que exista qualquer terceiro recebendo alguma coisa.
 */
export const consoleDestination: AnalyticsDestination = {
  send(event) {
    console.info(`[evento] ${event.name}`, event.properties);
  },
};
