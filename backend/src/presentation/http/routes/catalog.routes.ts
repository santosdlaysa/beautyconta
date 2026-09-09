import { Router } from "express";
import { CatalogController } from "../controllers/CatalogController";

const controller = new CatalogController();
const router = Router();

/**
 * Catálogos do documento 06. Públicos: a interface precisa das listas antes de
 * a usuária ter conta. Aceitam `?segment=nails` para priorizar o segmento.
 */
router.get("/catalog", controller.all);
router.get("/catalog/segments", controller.segments);
router.get("/catalog/work-models", controller.workModels);
router.get("/catalog/units", controller.units);
router.get("/catalog/material-categories", controller.materialCategories);
router.get("/catalog/fixed-cost-categories", controller.fixedCostCategories);
router.get("/catalog/service-categories", controller.serviceCategories);
router.get("/catalog/equipment-types", controller.equipmentTypes);

export { router as catalogRoutes };
