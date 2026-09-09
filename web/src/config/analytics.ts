import { createAnalyticsEmitter } from "@/application/use-cases/emit-analytics-event";
import { consoleDestination } from "@/infrastructure/telemetry/console-destination";
import { nullDestination } from "@/infrastructure/telemetry/null-destination";

/**
 * Raiz de composição da telemetria: o único arquivo que conhece um destino
 * concreto. Quando o ADR-0006 escolher a ferramenta, muda uma linha aqui e
 * nenhuma linha nas telas.
 */
const destination = process.env.NODE_ENV === "development" ? consoleDestination : nullDestination;

export const trackEvent = createAnalyticsEmitter(destination);
