import "dotenv/config";
import { parsePriceList } from "./plan-prices";

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
  /**
   * Avisos administrativos pelo Telegram.
   *
   * Sem as duas variáveis o sistema usa o `SilentNotifier` e nada é enviado —
   * é o padrão em desenvolvimento e na suíte. O par é tudo ou nada de
   * propósito: token sem destino não entrega nada, e falhar em silêncio a cada
   * evento seria pior do que não ligar.
   */
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? null,
    chatId: process.env.TELEGRAM_CHAT_ID ?? null,
    /**
     * Erro 5xx vira aviso. Desligável porque uma falha em laço pode virar
     * enxurrada de mensagem e derrubar o limite de envio do próprio Telegram.
     */
    alertOnServerError: process.env.TELEGRAM_ALERT_ON_ERROR !== "false",
    /** Horário do relatório diário, em cron, no fuso de Brasília. */
    dailyReportCron: process.env.TELEGRAM_DAILY_REPORT_CRON ?? "0 8 * * *",
  },
  billing: {
    /** Segredo do webhook do Mercado Pago; sem ele a assinatura não é conferida. */
    mercadoPagoWebhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? null,
    /**
     * Credencial de produção do Mercado Pago. Sem ela o checkout continua
     * respondendo que não está disponível, em vez de fingir que vendeu.
     */
    mercadoPagoAccessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN ?? null,
    /** Para onde o Mercado Pago devolve a assinante ao concluir o pagamento. */
    mercadoPagoReturnUrl:
      process.env.MERCADO_PAGO_RETURN_URL ?? "https://beautyconta.com.br/assinatura",
    /**
     * Endereço público deste servidor para o webhook do Pix.
     *
     * Sem ele o pagamento é aprovado e **nunca vira acesso**: a preferência não
     * tem para onde avisar. Vale a pena configurar mesmo tendo webhook no
     * painel — a preferência pode apontar para outro caminho.
     */
    mercadoPagoWebhookUrl: process.env.MERCADO_PAGO_WEBHOOK_URL ?? null,
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
    /**
     * Preço de cada oferta, em centavos inteiros, conforme o ADR-0002.
     * Formato: `PLANO:PERIODO:CENTAVOS`, separados por vírgula. Exemplo:
     * `PREMIUM:MONTHLY:2990,PREMIUM:ANNUAL:29900`.
     *
     * Sem esta variável, usa os preços publicados do Premium. Uma variável
     * explicitamente vazia desativa as ofertas deste catálogo.
     */
    prices: parsePriceList(process.env.PLAN_PRICES),
  },
  /**
   * Acesso ao painel administrativo.
   *
   * Sem `ADMIN_SECRET` a entrada por cabeçalho não existe, e sem `ADMIN_EMAILS`
   * a entrada pela sessão também não. Falha fechada nas duas: um painel que
   * aceita qualquer requisição quando alguém esquece a variável não avisa
   * ninguém — só entrega a lista de usuárias a quem descobrir a URL.
   */
  admin: {
    secret: process.env.ADMIN_SECRET ?? null,
    emails: (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean),
  },
  /**
   * Documentos que a tela de assinatura precisa linkar. As lojas exigem os dois
   * na mesma tela do botão de compra.
   */
  legal: {
    termsUrl: process.env.TERMS_URL ?? "https://beautyconta.com.br/termos",
    privacyUrl: process.env.PRIVACY_URL ?? "https://beautyconta.com.br/privacidade",
    supportEmail: process.env.SUPPORT_EMAIL ?? "suporte@beautyconta.com.br",
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
