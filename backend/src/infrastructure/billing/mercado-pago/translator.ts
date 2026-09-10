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

    // O identificador chega como texto na maioria das notificações e como
    // número em algumas. Recusar por causa do tipo faria o evento se perder em
    // silêncio: o Mercado Pago reenviaria, receberia 400 de novo e desistiria.
    const bruto = notification.data?.id;
    const dataId =
      typeof bruto === "string" ? bruto : typeof bruto === "number" ? String(bruto) : null;
    const type = notification.type ?? notification.topic;

    if (dataId === null || dataId === "" || typeof type !== "string") return null;
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
      // O que consultar depois. Sem isto o identificador do recurso morria na
      // tradução, e a notificação virava um registro sem consequência.
      reference: { type, externalId: dataId },
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

    const requestId = headers["x-request-id"] ?? "";

    /**
     * O identificador entra no manifesto de duas formas possíveis.
     *
     * A documentação do Mercado Pago manda usar o `data.id` **em minúsculas
     * quando ele é alfanumérico** — e os identificadores de `preapproval` são
     * alfanuméricos, ao contrário dos de pagamento, que são numéricos. Conferir
     * só a forma original recusaria em silêncio toda notificação de assinatura
     * cujo identificador viesse com alguma letra maiúscula: o evento levaria
     * 400, o Mercado Pago tentaria de novo, e depois desistiria — com a
     * assinatura paga e o plano nunca concedido.
     *
     * Aceitar as duas não enfraquece nada: as duas exigem HMAC válido feito com
     * o mesmo segredo, que só quem o tem consegue produzir.
     */
    const candidatos = new Set([dataId, dataId.toLowerCase()]);

    for (const id of candidatos) {
      const manifest = `id:${id};request-id:${requestId};ts:${ts};`;
      const expected = createHmac("sha256", this.webhookSecret).update(manifest).digest("hex");

      const a = Buffer.from(expected, "utf8");
      const b = Buffer.from(received, "utf8");
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    }

    return false;
  }
}
