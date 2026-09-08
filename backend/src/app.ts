import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler } from "./presentation/http/middleware/error-handler";
import { pricingRoutes } from "./presentation/http/routes/pricing.routes";

/**
 * Monta a aplicação sem subir o servidor, para que os testes possam exercitá-la
 * sem abrir porta.
 */
export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigins }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api", pricingRoutes);
  app.use(errorHandler);

  return app;
}
