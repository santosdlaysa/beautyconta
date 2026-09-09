import { Router } from "express";
import type { Dependencies } from "../../../application/ports/dependencies";
import { AccountController } from "../controllers/AccountController";
import { BookingController } from "../controllers/BookingController";
import { AppointmentController } from "../controllers/AppointmentController";
import { BusinessController } from "../controllers/BusinessController";
import { CalculationController } from "../controllers/CalculationController";
import { EquipmentController } from "../controllers/EquipmentController";
import { FixedCostController } from "../controllers/FixedCostController";
import { MaterialController } from "../controllers/MaterialController";
import { ServiceController } from "../controllers/ServiceController";
import { SessionController } from "../controllers/SessionController";
import { SubscriptionController } from "../controllers/SubscriptionController";
import { asyncHandler } from "../middleware/async-handler";
import { requireUser } from "../middleware/identity";
import { createRateLimiters, type RateLimiters } from "../middleware/rate-limit";
import { catalogRoutes } from "./catalog.routes";
import { pricingRoutes } from "./pricing.routes";

/**
 * Mapa da API.
 *
 * Três anéis, do mais aberto ao mais restrito:
 *
 * 1. público — calculadora, simulador e catálogos, sem cadastro, porque a
 *    calculadora nunca fica atrás de pagamento (documento 01, seção 6);
 * 2. autenticado — conta e negócios da usuária;
 * 3. por negócio — tudo sob `/businesses/:businessId`, onde cada rota passa
 *    pela guarda de acesso do item B-03 antes de tocar em qualquer dado.
 *
 * Webhooks ficam fora dos três: quem chama é o processador, não a usuária.
 */
export function createApiRouter(deps: Dependencies): Router {
  const router = Router();
  const limites = createRateLimiters();

  // As rotas abertas levam teto de requisição; as autenticadas já têm a
  // sessão como barreira e o custo por requisição é baixo.
  router.use(limites.public, pricingRoutes);
  router.use(limites.public, catalogRoutes);
  router.use("/booking", bookingRoutes(deps, limites));

  router.use(sessionRoutes(deps, limites));
  router.use(accountRoutes(deps, limites));
  router.use("/businesses", businessRoutes(deps, limites));
  router.use("/billing", billingRoutes(deps, limites));

  return router;
}

/** Entrada e saída da conta: as duas rotas que criam e destroem identidade. */
function sessionRoutes(deps: Dependencies, limites: RateLimiters): Router {
  const controller = new SessionController(deps);
  const router = Router();

  router.post("/sessions", limites.session, asyncHandler(controller.create));
  router.delete("/sessions/current", requireUser, asyncHandler(controller.destroy));

  return router;
}

function accountRoutes(deps: Dependencies, limites: RateLimiters): Router {
  const controller = new AccountController(deps);
  const router = Router();

  // O cadastro é a única rota de conta sem identidade prévia.
  router.post("/users", limites.account, asyncHandler(controller.create));
  router.patch(
    "/users/me/password",
    limites.account,
    requireUser,
    asyncHandler(controller.changePassword),
  );
  router.get("/users/me", requireUser, asyncHandler(controller.me));
  router.patch("/users/me", requireUser, asyncHandler(controller.update));
  router.delete("/users/me", requireUser, asyncHandler(controller.remove));

  return router;
}

function businessRoutes(deps: Dependencies, limites: RateLimiters): Router {
  const businesses = new BusinessController(deps);
  const router = Router();

  router.use(requireUser);

  router.post("/", limites.write, asyncHandler(businesses.create));
  router.get("/", asyncHandler(businesses.list));
  router.get("/:businessId", asyncHandler(businesses.get));
  router.patch("/:businessId", asyncHandler(businesses.update));
  router.get("/:businessId/settings", asyncHandler(businesses.getSettings));
  router.put("/:businessId/settings", asyncHandler(businesses.saveSettings));
  router.get("/:businessId/export", asyncHandler(businesses.export));

  // Expediente e link da agenda pública ficam com a dona do negócio.
  const booking = new BookingController(deps);
  router.get("/:businessId/hours", asyncHandler(booking.getHours));
  router.put("/:businessId/hours", asyncHandler(booking.saveHours));
  router.post("/:businessId/booking-link", limites.write, asyncHandler(booking.enableLink));
  router.put("/:businessId/booking-link", limites.write, asyncHandler(booking.renameLink));
  router.delete("/:businessId/booking-link", asyncHandler(booking.disableLink));

  // `mergeParams` mantém `:businessId` visível nos sub-recursos.
  const scoped = Router({ mergeParams: true });
  // As criações abrem transação com bloqueio de linha; o teto evita que uma
  // conta sozinha ocupe o pool de conexões inteiro. Aplicado por método, e não
  // por padrão de rota: o Express 5 não aceita mais `*` solto no caminho.
  scoped.use((req, res, next) =>
    req.method === "POST" ? limites.write(req, res, next) : next(),
  );
  mountMaterials(scoped, deps);
  mountFixedCosts(scoped, deps);
  mountServices(scoped, deps);
  mountCalculations(scoped, deps);
  mountAppointments(scoped, deps);
  mountEquipment(scoped, deps);
  mountSubscription(scoped, deps);

  router.use("/:businessId", scoped);

  return router;
}

function mountMaterials(router: Router, deps: Dependencies): void {
  const controller = new MaterialController(deps);

  router.post("/materials", asyncHandler(controller.create));
  router.get("/materials", asyncHandler(controller.list));
  router.get("/materials/:id", asyncHandler(controller.get));
  router.patch("/materials/:id", asyncHandler(controller.update));
  router.post("/materials/:id/archive", asyncHandler(controller.archive));
  router.post("/materials/:id/restore", asyncHandler(controller.restore));
  router.delete("/materials/:id", asyncHandler(controller.remove));
}

function mountFixedCosts(router: Router, deps: Dependencies): void {
  const controller = new FixedCostController(deps);

  router.post("/fixed-costs", asyncHandler(controller.create));
  router.get("/fixed-costs", asyncHandler(controller.list));
  router.get("/fixed-costs/:id", asyncHandler(controller.get));
  router.patch("/fixed-costs/:id", asyncHandler(controller.update));
  router.delete("/fixed-costs/:id", asyncHandler(controller.remove));
}

function mountServices(router: Router, deps: Dependencies): void {
  const controller = new ServiceController(deps);

  router.post("/services", asyncHandler(controller.create));
  router.get("/services", asyncHandler(controller.list));
  router.get("/services/:id", asyncHandler(controller.get));
  router.patch("/services/:id", asyncHandler(controller.update));
  router.post("/services/:id/duplicate", asyncHandler(controller.duplicate));
  router.post("/services/:id/archive", asyncHandler(controller.archive));
  router.post("/services/:id/restore", asyncHandler(controller.restore));
  router.delete("/services/:id", asyncHandler(controller.remove));

  // Calcula com os dados cadastrados; grava no histórico quando `save` é true.
  router.post("/services/:id/pricing", asyncHandler(controller.price));
}

function mountCalculations(router: Router, deps: Dependencies): void {
  const controller = new CalculationController(deps);

  router.get("/calculations", asyncHandler(controller.list));
  router.get("/calculations/:id", asyncHandler(controller.get));
  router.post("/calculations", asyncHandler(controller.create));
}

/** Agenda do dia e o que entrou por ela. */
function mountAppointments(router: Router, deps: Dependencies): void {
  const controller = new AppointmentController(deps);

  router.post("/appointments", asyncHandler(controller.create));
  router.get("/appointments", asyncHandler(controller.list));
  // Antes de `/:id` para o resumo não ser lido como identificador.
  router.get("/appointments/summary", asyncHandler(controller.summary));
  router.get("/appointments/:id", asyncHandler(controller.get));
  router.patch("/appointments/:id", asyncHandler(controller.update));
  router.post("/appointments/:id/settle", asyncHandler(controller.settle));
  router.delete("/appointments/:id", asyncHandler(controller.remove));
}

function mountEquipment(router: Router, deps: Dependencies): void {
  const controller = new EquipmentController(deps);

  router.post("/equipment", asyncHandler(controller.create));
  router.get("/equipment", asyncHandler(controller.list));
  router.get("/equipment/:id", asyncHandler(controller.get));
  router.patch("/equipment/:id", asyncHandler(controller.update));
  router.delete("/equipment/:id", asyncHandler(controller.remove));
}

function mountSubscription(router: Router, deps: Dependencies): void {
  const controller = new SubscriptionController(deps);

  router.get("/subscription", asyncHandler(controller.status));
  router.post("/subscription/checkout", asyncHandler(controller.checkout));
  router.post("/subscription/:id/cancel", asyncHandler(controller.cancel));
}

function billingRoutes(deps: Dependencies, limites: RateLimiters): Router {
  const controller = new SubscriptionController(deps);
  const router = Router();

  // Sem `requireUser`: quem chama é o processador. A autenticação é a
  // assinatura do webhook, conferida dentro do tradutor de cada provedor.
  router.post("/webhooks/:source", limites.webhook, asyncHandler(controller.webhook));

  return router;
}

/**
 * Agenda pública, aberta: quem entra é a cliente, com o link e sem conta.
 *
 * O teto de requisição é mais apertado que o das outras rotas abertas porque
 * marcar cria registro no banco de outra pessoa — e o endereço secreto protege
 * contra quem não tem o link, não contra quem tem.
 */
function bookingRoutes(deps: Dependencies, limites: RateLimiters): Router {
  const controller = new BookingController(deps);
  const router = Router();

  router.get("/:slug", limites.public, asyncHandler(controller.page));
  router.get("/:slug/slots", limites.public, asyncHandler(controller.slots));
  router.post("/:slug/appointments", limites.booking, asyncHandler(controller.book));

  return router;
}
