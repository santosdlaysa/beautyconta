import { API_URL } from "@/config/api";
import { createHttpBookingGateway } from "@/infrastructure/booking/http-booking-gateway";

/**
 * Raiz de composição da agenda pública: o único arquivo que liga o contrato ao
 * adaptador HTTP, no mesmo espírito de `config/analytics.ts`. A página e o
 * componente da cliente importam daqui e não conhecem `fetch`.
 */
export const bookingGateway = createHttpBookingGateway(API_URL);
