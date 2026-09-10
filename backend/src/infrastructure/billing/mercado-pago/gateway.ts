import type {
  BillingReference,
  BillingStateResolver,
  CheckoutRequest,
  CheckoutSession,
  ResolvedSubscription,
  SubscriptionGateway,
} from "../../../application/ports/billing";
import type { BillingPeriodSlug } from "../../../application/ports/records";
import type { SubscriptionStatusSlug } from "../../../domain/billing/subscription-access";

/**
 * Checkout do Mercado Pago, item F-02.
 *
 * Dois caminhos, porque o Mercado Pago tem dois produtos diferentes e a
 * diferença chega até a assinante:
 *
 * - **cartão** vira uma `preapproval`, que é assinatura de verdade: cobra
 *   sozinha todo período até alguém cancelar;
 * - **Pix** vira uma preferência de pagamento avulso. O Mercado Pago **não faz
 *   cobrança recorrente por Pix** — não é limitação nossa, é do meio de
 *   pagamento. Quem paga por Pix compra um período que termina, e por isso a
 *   assinatura nasce com `cancelAtPeriodEnd`, sem promessa de renovar.
 *
 * Nenhuma decisão de acesso acontece aqui: este objeto abre o checkout e lê o
 * estado que o Mercado Pago informa. Quem concede plano é a aplicação, quando o
 * webhook chega — a regra da seção 3 do documento 11.
 */

const API = "https://api.mercadopago.com";

/** Falha de comunicação com o processador, separada de erro de regra. */
export class MercadoPagoError extends Error {
  readonly code = "gateway_error";

  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "MercadoPagoError";
  }
}

export type MercadoPagoConfig = {
  accessToken: string;
  /** Para onde o Mercado Pago devolve a assinante ao concluir. */
  returnUrl: string;
  /** Endereço público do webhook; sem ele o pagamento não vira acesso. */
  webhookUrl: string | null;
};

type Fetch = typeof globalThis.fetch;

export class MercadoPagoGateway implements SubscriptionGateway, BillingStateResolver {
  readonly provider = "MERCADO_PAGO" as const;
  readonly channel = "WEB" as const;

  constructor(
    private readonly config: MercadoPagoConfig,
    /** Injetado para que a suíte exercite o gateway sem tocar a rede. */
    private readonly fetchImpl: Fetch = globalThis.fetch,
  ) {}

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    return request.paymentMethod === "pix"
      ? this.createPixCheckout(request)
      : this.createCardSubscription(request);
  }

  /**
   * Assinatura recorrente no cartão.
   *
   * `external_reference` carrega o identificador do negócio: é ele que amarra a
   * cobrança à conta quando o webhook voltar, porque a notificação do Mercado
   * Pago não diz de quem é.
   */
  private async createCardSubscription(request: CheckoutRequest): Promise<CheckoutSession> {
    const body = {
      reason: describePlan(request.plan, request.billingPeriod),
      external_reference: request.businessId,
      back_url: request.returnUrl ?? this.config.returnUrl,
      auto_recurring: {
        frequency: request.billingPeriod === "ANNUAL" ? 12 : 1,
        frequency_type: "months",
        transaction_amount: centsToAmount(request.priceCents),
        currency_id: "BRL",
      },
      status: "pending",
    };

    const created = await this.post<{ id?: unknown; init_point?: unknown }>("/preapproval", body);

    const checkoutUrl = asText(created.init_point);
    const id = asText(created.id);

    if (!checkoutUrl || !id) {
      throw new MercadoPagoError("O Mercado Pago não devolveu o endereço do checkout.", null);
    }

    return {
      provider: this.provider,
      channel: this.channel,
      checkoutUrl,
      providerSubscriptionId: id,
      paymentMethod: "card",
    };
  }

  /**
   * Pagamento avulso por Pix, via preferência do Checkout Pro.
   *
   * A preferência é preferida ao pagamento direto de propósito: criar um
   * pagamento Pix pela API exige nome, sobrenome, e-mail e CPF do pagador, e
   * pedir CPF para assinar seria coletar documento que o produto não precisa
   * guardar. Na preferência, quem coleta é o Mercado Pago, na página dele.
   *
   * `purpose: "wallet_purchase"` fica de fora porque exigiria conta Mercado
   * Pago; aqui o pagamento avulso aceita quem só quer escanear o código.
   */
  private async createPixCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const body = {
      items: [
        {
          id: `${request.plan}_${request.billingPeriod}`,
          title: describePlan(request.plan, request.billingPeriod),
          quantity: 1,
          currency_id: "BRL",
          unit_price: centsToAmount(request.priceCents),
        },
      ],
      external_reference: request.businessId,
      back_urls: {
        success: request.returnUrl ?? this.config.returnUrl,
        pending: request.returnUrl ?? this.config.returnUrl,
        failure: request.returnUrl ?? this.config.returnUrl,
      },
      // Só Pix: o cartão tem caminho próprio, que renova sozinho. Deixar os dois
      // na mesma preferência venderia como avulso o que deveria ser assinatura.
      payment_methods: {
        excluded_payment_types: [{ id: "credit_card" }, { id: "debit_card" }, { id: "ticket" }],
        installments: 1,
      },
      ...(this.config.webhookUrl ? { notification_url: this.config.webhookUrl } : {}),
    };

    const created = await this.post<{ id?: unknown; init_point?: unknown }>(
      "/checkout/preferences",
      body,
    );

    const checkoutUrl = asText(created.init_point);
    const id = asText(created.id);

    if (!checkoutUrl || !id) {
      throw new MercadoPagoError("O Mercado Pago não devolveu o endereço do Pix.", null);
    }

    return {
      provider: this.provider,
      channel: this.channel,
      checkoutUrl,
      providerSubscriptionId: id,
      paymentMethod: "pix",
    };
  }

  /**
   * Cancela a renovação.
   *
   * Só faz sentido para `preapproval`: um Pix já pago não tem o que cancelar, e
   * o período comprado segue até o fim — que é o certo, porque foi pago.
   */
  async cancel(providerSubscriptionId: string): Promise<void> {
    await this.put(`/preapproval/${providerSubscriptionId}`, { status: "cancelled" });
  }

  /**
   * Descobre o que a notificação significa.
   *
   * O webhook do Mercado Pago diz apenas que algo mudou; o estado real exige
   * esta consulta. É aqui que Pix e cartão voltam a se separar: um pagamento
   * aprovado concede um período fechado, uma `preapproval` reflete o estado da
   * assinatura.
   */
  async resolve(reference: BillingReference): Promise<ResolvedSubscription | null> {
    if (reference.type.startsWith("payment")) return this.resolvePayment(reference.externalId);
    if (reference.type.includes("preapproval")) return this.resolvePreapproval(reference.externalId);

    return null;
  }

  private async resolvePayment(paymentId: string): Promise<ResolvedSubscription | null> {
    const payment = await this.get<{
      status?: unknown;
      external_reference?: unknown;
      date_approved?: unknown;
      transaction_amount?: unknown;
      metadata?: { billing_period?: unknown } | null;
      additional_info?: { items?: { id?: unknown }[] } | null;
    }>(`/v1/payments/${paymentId}`);

    const businessId = asText(payment.external_reference);
    if (!businessId) return null;

    // Pagamento não aprovado não concede nada. Recusado, pendente e estornado
    // caem aqui, e o silêncio é a resposta certa: conceder para depois tirar
    // seria dar acesso a quem não pagou.
    if (asText(payment.status) !== "approved") return null;

    const approvedAt = asDate(payment.date_approved) ?? new Date();
    const billingPeriod = periodFromItem(payment.additional_info?.items?.[0]?.id);

    return {
      businessId,
      subscription: {
        plan: planFromItem(payment.additional_info?.items?.[0]?.id),
        status: "active" satisfies SubscriptionStatusSlug,
        channel: this.channel,
        billingPeriod,
        providerSubscriptionId: `payment:${paymentId}`,
        currentPeriodStart: approvedAt,
        currentPeriodEnd: addPeriod(approvedAt, billingPeriod),
        // Pix não renova. A assinatura nasce sabendo a data em que termina.
        cancelAtPeriodEnd: true,
      },
    };
  }

  private async resolvePreapproval(preapprovalId: string): Promise<ResolvedSubscription | null> {
    const preapproval = await this.get<{
      status?: unknown;
      external_reference?: unknown;
      reason?: unknown;
      payer_id?: unknown;
      auto_recurring?: { frequency?: unknown; frequency_type?: unknown } | null;
      next_payment_date?: unknown;
      date_created?: unknown;
    }>(`/preapproval/${preapprovalId}`);

    const businessId = asText(preapproval.external_reference);
    if (!businessId) return null;

    const status = statusFromPreapproval(asText(preapproval.status));
    if (!status) return null;

    const billingPeriod: BillingPeriodSlug =
      Number(preapproval.auto_recurring?.frequency) === 12 ? "ANNUAL" : "MONTHLY";

    return {
      businessId,
      subscription: {
        plan: planFromReason(asText(preapproval.reason)),
        status: status.status,
        channel: this.channel,
        billingPeriod,
        providerSubscriptionId: preapprovalId,
        providerCustomerId: asText(preapproval.payer_id),
        mpPreapprovalId: preapprovalId,
        currentPeriodStart: asDate(preapproval.date_created),
        currentPeriodEnd: asDate(preapproval.next_payment_date),
        cancelAtPeriodEnd: status.cancelAtPeriodEnd,
      },
    };
  }

  private get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.fetchImpl(`${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.config.accessToken}`,
        "content-type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      // O corpo do erro do Mercado Pago costuma explicar o motivo, mas pode
      // conter dados do pagador; ele vai para o registro, nunca para a tela.
      const detalhe = await response.text().catch(() => "");
      console.warn(`[mercado-pago] ${method} ${path} respondeu ${response.status}: ${detalhe}`);

      throw new MercadoPagoError(
        "Não foi possível falar com o Mercado Pago agora. Tente de novo em instantes.",
        response.status,
      );
    }

    return (await response.json()) as T;
  }
}

/**
 * Centavos para o número decimal que a API espera.
 *
 * A conversão acontece só aqui, na borda: dentro do sistema o dinheiro é
 * inteiro, conforme o ADR-0002.
 */
function centsToAmount(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

function describePlan(plan: string, billingPeriod: BillingPeriodSlug): string {
  const periodo = billingPeriod === "ANNUAL" ? "anual" : "mensal";
  return `BeautyConta ${plan === "MASTER" ? "Master" : "Premium"} — ${periodo}`;
}

/** O item da preferência carrega `PLANO_PERIODO`; é assim que o plano volta. */
function planFromItem(id: unknown): "PREMIUM" | "MASTER" {
  return asText(id)?.startsWith("MASTER") ? "MASTER" : "PREMIUM";
}

function periodFromItem(id: unknown): BillingPeriodSlug {
  return asText(id)?.endsWith("ANNUAL") ? "ANNUAL" : "MONTHLY";
}

function planFromReason(reason: string | null): "PREMIUM" | "MASTER" {
  return reason?.toLowerCase().includes("master") ? "MASTER" : "PREMIUM";
}

/**
 * Estado da `preapproval` para o vocabulário do domínio.
 *
 * `cancelled` não vira acesso cortado na hora: a seção 4 do documento 11 diz
 * que o período pago segue valendo. O corte vem da data de fim.
 */
function statusFromPreapproval(
  status: string | null,
): { status: SubscriptionStatusSlug; cancelAtPeriodEnd: boolean } | null {
  switch (status) {
    case "authorized":
      return { status: "active", cancelAtPeriodEnd: false };
    case "paused":
      return { status: "paused", cancelAtPeriodEnd: false };
    case "cancelled":
      return { status: "active", cancelAtPeriodEnd: true };
    case "pending":
      // Ainda não autorizada: não concede nada, e não é erro.
      return null;
    default:
      return null;
  }
}

/** Soma o período comprado. Um mês de calendário, não trinta dias. */
function addPeriod(from: Date, billingPeriod: BillingPeriodSlug): Date {
  const fim = new Date(from.getTime());
  fim.setUTCMonth(fim.getUTCMonth() + (billingPeriod === "ANNUAL" ? 12 : 1));
  return fim;
}

function asText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return null;
}

function asDate(value: unknown): Date | null {
  const texto = asText(value);
  if (!texto) return null;

  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? null : data;
}
