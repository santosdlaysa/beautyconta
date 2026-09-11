import { Router, type RequestHandler } from "express";
import { PricingController } from "../controllers/PricingController";

/**
 * Calculadora e simulador públicos.
 *
 * Montado sob `/pricing` para que o teto de requisição valha só para estas
 * rotas: middleware posto ao lado de um roteador montado na raiz roda em toda
 * a API, inclusive nas rotas autenticadas, que têm outro teto.
 */
export function pricingRoutes(limite: RequestHandler): Router {
  const controller = new PricingController();
  const router = Router();

  router.use(limite);

  /** Calculadora pública: não exige autenticação, conforme a jornada do documento 02. */
  router.post("/calculate", controller.calculate);

  /** Simulador de meta, item A-04. Também público: é projeção, não cadastro. */
  router.post("/goal", controller.goal);

  return router;
}
