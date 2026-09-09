import { Router } from "express";
import { PricingController } from "../controllers/PricingController";

const controller = new PricingController();
const router = Router();

/** Calculadora pública: não exige autenticação, conforme a jornada do documento 02. */
router.post("/pricing/calculate", controller.calculate);

/** Simulador de meta, item A-04. Também público: é projeção, não cadastro. */
router.post("/pricing/goal", controller.goal);

export { router as pricingRoutes };
