import "dotenv/config";

/**
 * Configuração lida uma única vez, na borda do processo.
 *
 * Nenhuma camada interna lê `process.env`: quem precisa de configuração a
 * recebe por parâmetro, conforme o ADR-0008.
 */
export const env = {
  port: Number(process.env.PORT ?? 3333),
  /**
   * Sem `CORS_ORIGINS`, o padrão cobre o desenvolvimento: a web em 3000 e o
   * Expo web nas portas que ele costuma abrir. Em produção a variável é
   * obrigatória, e nenhuma dessas origens existe lá.
   */
  corsOrigins: (
    process.env.CORS_ORIGINS ??
    "http://localhost:3000,http://localhost:8081,http://localhost:8082,http://localhost:19006"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  nodeEnv: process.env.NODE_ENV ?? "development",
  billing: {
    /** Segredo do webhook do Mercado Pago; sem ele a assinatura não é conferida. */
    mercadoPagoWebhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? null,
    /** Valor do cabeçalho `Authorization` combinado no painel do RevenueCat. */
    revenueCatAuthorization: process.env.REVENUECAT_WEBHOOK_AUTHORIZATION ?? null,
    /**
     * Mapa de identificador de produto para plano, exigido pelo item F-03.
     * Formato: `produto:PLANO:PERIODO`, separados por vírgula. Exemplo:
     * `beautyconta_premium_monthly:PREMIUM:MONTHLY,beautyconta_master_annual:MASTER:ANNUAL`.
     */
    revenueCatProducts: parseProductMap(process.env.REVENUECAT_PRODUCTS),
    /** Só para homologação: em produção, compra de teste não concede plano. */
    revenueCatAcceptSandbox: process.env.REVENUECAT_ACCEPT_SANDBOX === "true",
  },
};

export type ProductMapping = {
  productId: string;
  plan: "PREMIUM" | "MASTER";
  billingPeriod: "MONTHLY" | "ANNUAL";
};

function parseProductMap(raw: string | undefined): ProductMapping[] {
  if (!raw) return [];

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry): ProductMapping[] => {
      const [productId, plan, billingPeriod] = entry.split(":").map((part) => part?.trim());

      if (
        !productId ||
        (plan !== "PREMIUM" && plan !== "MASTER") ||
        (billingPeriod !== "MONTHLY" && billingPeriod !== "ANNUAL")
      ) {
        // Configuração torta é ignorada com aviso: derrubar o processo por
        // causa de uma linha errada deixaria a API inteira fora do ar.
        console.warn(`[env] Entrada inválida em REVENUECAT_PRODUCTS: "${entry}"`);
        return [];
      }

      return [{ productId, plan, billingPeriod }];
    });
}
