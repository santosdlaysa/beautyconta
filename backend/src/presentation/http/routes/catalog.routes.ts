import { Router, type RequestHandler } from "express";
import { CatalogController } from "../controllers/CatalogController";

/**
 * Catálogos do documento 06. Públicos: a interface precisa das listas antes de
 * a usuária ter conta. Aceitam `?segment=nails` para priorizar o segmento.
 *
 * Montado sob `/catalog` para que o teto de requisição fique restrito a estas
 * rotas — ver a explicação em `pricing.routes.ts`.
 */
export function catalogRoutes(limite: RequestHandler): Router {
  const controller = new CatalogController();
  const router = Router();

  router.use(limite);

  router.get("/", controller.all);
  router.get("/segments", controller.segments);
  router.get("/work-models", controller.workModels);
  router.get("/units", controller.units);
  router.get("/material-categories", controller.materialCategories);
  router.get("/fixed-cost-categories", controller.fixedCostCategories);
  router.get("/service-categories", controller.serviceCategories);
  router.get("/equipment-types", controller.equipmentTypes);

  return router;
}
