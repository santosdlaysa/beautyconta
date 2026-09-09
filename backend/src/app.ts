import cors from "cors";
import express from "express";
import type { Dependencies } from "./application/ports/dependencies";
import { env } from "./config/env";
import { createDependencies } from "./infrastructure/container";
import { checkDatabase } from "./infrastructure/persistence/prisma/client";
import { errorHandler } from "./presentation/http/middleware/error-handler";
import { resolveIdentity } from "./presentation/http/middleware/identity";
import { createApiRouter } from "./presentation/http/routes";

/**
 * Monta a aplicação sem subir o servidor, para que os testes possam exercitá-la
 * sem abrir porta.
 *
 * As dependências entram por parâmetro: em produção vem o Prisma sobre o
 * PostgreSQL, na suíte vêm repositórios em memória. A API montada é a mesma nos
 * dois casos, o que é o ponto de testar contra ela.
 */
export function createApp(deps: Dependencies = createDependencies()) {
  const app = express();

  // O Render põe um proxy na frente. Sem isto, todo mundo chega com o mesmo
  // endereço e o teto de requisição puniria as usuárias em bloco em vez de
  // conter quem ataca. O `1` é o número de saltos confiáveis: confiar em
  // qualquer cabeçalho encaminhado deixaria o teto ser burlado à vontade.
  app.set("trust proxy", 1);

  app.use(cors({ origin: env.corsOrigins }));
  app.use(express.json({ limit: "1mb" }));
  app.use(resolveIdentity(deps));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Separado do /health porque só esta rota faz ida e volta ao banco.
  app.get("/health/db", async (_req, res) => {
    const connected = await checkDatabase();
    res.status(connected ? 200 : 503).json({ database: connected ? "ok" : "unreachable" });
  });

  app.use("/api", createApiRouter(deps));
  app.use(errorHandler);

  return app;
}
