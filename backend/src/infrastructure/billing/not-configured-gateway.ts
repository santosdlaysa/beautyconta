import type {
  CheckoutRequest,
  CheckoutSession,
  SubscriptionGateway,
} from "../../application/ports/billing";

/**
 * Erro de infraestrutura ausente, e não de regra de negócio: a assinante não
 * errou nada, o checkout é que ainda não existe.
 */
export class GatewayNotConfiguredError extends Error {
  readonly code = "gateway_not_configured";

  constructor(provider: string) {
    super(
      `A assinatura por ${provider} ainda não está disponível. ` +
        "Você continua usando a calculadora e tudo o que já cadastrou.",
    );
    this.name = "GatewayNotConfiguredError";
  }
}

/**
 * Gateway de espera.
 *
 * O ADR-0004 escolheu Mercado Pago e RevenueCat, mas o checkout depende de duas
 * decisões abertas: o ADR-0005, que define onde as credenciais e os webhooks
 * vivem, e o ADR-0007, que fixa periodicidade e política de reembolso.
 *
 * Implementar um checkout agora significaria inventar essas decisões. O que já
 * existe e é testável — verificação de canal duplicado, idempotência do webhook
 * e `subscriptions` como fonte de verdade — está implementado; o que depende
 * das credenciais responde com uma mensagem honesta.
 */
export class NotConfiguredGateway implements SubscriptionGateway {
  readonly provider = "MERCADO_PAGO" as const;
  readonly channel = "WEB" as const;

  createCheckout(_request: CheckoutRequest): Promise<CheckoutSession> {
    void _request;
    return Promise.reject(new GatewayNotConfiguredError("Mercado Pago"));
  }

  cancel(_providerSubscriptionId: string): Promise<void> {
    void _providerSubscriptionId;
    return Promise.reject(new GatewayNotConfiguredError("Mercado Pago"));
  }
}
