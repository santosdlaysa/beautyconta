import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  BillingEventTranslation,
  BillingWebhookTranslator,
} from "../../../application/ports/billing";

type MercadoPagoNotification = {
  id?: unknown;
  type?: unknown;
  topic?: unknown;
  action?: unknown;
  data?: { id?: unknown } | null;
};

/**
 * Tradutor do webhook do Mercado Pago, item F-02.
 *
 * A notificação do Mercado Pago diz que algo mudou, não o que mudou: o status
 * real da `preapproval` exige uma consulta autenticada à API deles. Por isso
 * este tradutor devolve `subscription: null` — o evento bruto é gravado, a
 * idempotência é garantida, e a atualização de `subscriptions` fica para quando
 * o ADR-0005 definir onde as credenciais vivem.
 *
 * Gravar antes de processar é justamente o que permite reprocessar depois sem
 * perder nenhuma notificação recebida nesse meio-tempo.
 */
export class MercadoPagoTranslator implements BillingWebhookTranslator {
  readonly provider = "MERCADO_PAGO" as const;

  constructor(private readonly webhookSecret: string | null) {}

  translate(
    payload: unknown,
    headers: Record<string, string | undefined>,
  ): BillingEventTranslation | null {
    const notification = payload as MercadoPagoNotification | null;
    if (!notification) return null;

    const dataId = notification.data?.id;
    const type = notification.type ?? notification.topic;

    if (typeof dataId !== "string" || typeof type !== "string") return null;
    if (!this.hasValidSignature(headers, dataId)) return null;

    // O `id` da notificação é o que o Mercado Pago reenvia igual em cada
    // tentativa; ele é a chave da idempotência.
    const externalEventId =
      notification.id === undefined || notification.id === null
        ? `${type}:${dataId}:${String(notification.action ?? "")}`
        : `mp:${String(notification.id)}`;

    return {
      externalEventId,
      type: typeof notification.action === "string" ? notification.action : type,
      businessId: null,
      subscription: null,
    };
  }

  /**
   * Assinatura `x-signature` no formato `ts=...,v1=...`, sobre o manifesto
   * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`.
   *
   * Sem segredo configurado, **nada é aceito**. A falha é fechada de
   * propósito: um webhook sem verificação aceita qualquer pessoa que descubra a
   * URL, e quem esquecesse a variável de ambiente não veria erro nenhum — só
   * uma tabela de eventos de cobrança que qualquer um pode escrever.
   */
  private hasValidSignature(
    headers: Record<string, string | undefined>,
    dataId: string,
  ): boolean {
    if (!this.webhookSecret) return false;

    const signature = headers["x-signature"];
    if (!signature) return false;

    const parts = new Map(
      signature.split(",").map((part) => {
        const [key, value] = part.split("=", 2);
        return [key?.trim() ?? "", value?.trim() ?? ""];
      }),
    );

    const ts = parts.get("ts");
    const received = parts.get("v1");
    if (!ts || !received) return false;

    const manifest = `id:${dataId};request-id:${headers["x-request-id"] ?? ""};ts:${ts};`;
    const expected = createHmac("sha256", this.webhookSecret).update(manifest).digest("hex");

    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(received, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
