import "dotenv/config";

/** Configuração lida uma única vez, na borda do processo. */
export const env = {
  port: Number(process.env.PORT ?? 3333),
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  nodeEnv: process.env.NODE_ENV ?? "development",
};
