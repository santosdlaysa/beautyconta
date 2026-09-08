import { Router } from "express";
import { PricingController } from "../controllers/PricingController";

const controller = new PricingController();
const router = Router();

/** Calculadora pública: não exige autenticação, conforme a jornada do documento 02. */
router.post("/pricing/calculate", controller.calculate);

export { router as pricingRoutes };
