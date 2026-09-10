import type { AdminNotice, Notifier } from "../../application/ports/notifications";
import type { AdminMetrics } from "../../application/ports/repositories";

/** Rótulos dos eventos de cobrança, como o provedor os nomeia. */
const SUBSCRIPTION_LABELS: Record<string, string> = {
  INITIAL_PURCHASE: "💎 Nova assinatura",
  RENEWAL: "🔄 Renovação",
  CANCELLATION: "❌ Cancelamento",
  EXPIRATION: "⏰ Expiração",
  UNCANCELLATION: "🔙 Reativação",
  PRODUCT_CHANGE: "🔀 Troca de plano",
  BILLING_ISSUE: "⚠️ Problema de cobrança",
};

const CHANNEL_LABELS: Record<string, string> = {
  WEB: "site",
  ANDROID: "Google Play",
  IOS: "App Store",
};

/**
 * Avisos administrativos pelo Telegram.
 *
 * Duas decisões carregam este arquivo:
 *
 * O envio **nunca propaga erro**. Cada `notify` está pendurado num fluxo que já
 * deu certo — o cadastro foi feito, o webhook foi gravado — e derrubá-lo porque
 * a API do Telegram engasgou trocaria um aviso perdido por um prejuízo real. A
 * falha vira uma linha no registro e o fluxo segue.
 *
 * O texto mora aqui, e não no caso de uso, porque formatação é assunto de quem
 * entrega: o Telegram tem limite de tamanho e engole `<` e `&` quando se pede
 * HTML, coisas que a aplicação não deveria precisar saber. Por isso o envio é
 * em texto puro, sem `parse_mode` — nome de negócio com `<` ou `&` chegaria
 * truncado ou sumiria a mensagem inteira, e nome é dado que a usuária escolhe.
 */
export class TelegramNotifier implements Notifier {
  constructor(
    private readonly botToken: string,
    private readonly chatId: string,
    /** Injetável para que o teste não precise de rede. */
    private readonly send: typeof fetch = fetch,
  ) {}

  async notify(notice: AdminNotice): Promise<void> {
    try {
      await this.deliver(this.render(notice));
    } catch (error) {
      // Aviso é acessório: registrar e seguir é o comportamento correto.
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[telegram] aviso "${notice.kind}" não enviado: ${reason}`);
    }
  }

  private async deliver(text: string): Promise<void> {
    const response = await this.send(
      `https://api.telegram.org/bot${this.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: this.chatId, text }),
        // Sem teto, uma API pendurada seguraria o processo indefinidamente.
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) {
      throw new Error(`Telegram respondeu ${response.status}`);
    }
  }

  private render(notice: AdminNotice): string {
    switch (notice.kind) {
      case "new_user":
        return [
          "🆕 Novo cadastro no BeautyConta",
          "",
          `👤 ${notice.name}`,
          `📧 ${notice.email}`,
          `🕐 ${brNow()}`,
        ].join("\n");

      case "subscription": {
        const label = SUBSCRIPTION_LABELS[notice.eventType] ?? `📌 ${notice.eventType}`;
        const channel = notice.channel ? CHANNEL_LABELS[notice.channel] ?? notice.channel : null;
        return [
          label,
          "",
          `🏪 ${notice.businessName ?? "negócio não identificado"}`,
          notice.plan ? `📋 Plano: ${notice.plan}` : null,
          channel ? `📱 Origem: ${channel}` : null,
          `🕐 ${brNow()}`,
        ]
          .filter((line): line is string => line !== null)
          .join("\n");
      }

      case "server_error":
        return [
          "🚨 Erro no servidor",
          "",
          `${notice.method} ${notice.path}`,
          `Status: ${notice.statusCode}`,
          notice.detail ? `Erro: ${truncate(notice.detail, 300)}` : null,
          `🕐 ${brNow()}`,
        ]
          .filter((line): line is string => line !== null)
          .join("\n");

      case "daily_report":
        return renderDailyReport(notice.metrics);
    }
  }
}

function renderDailyReport(m: AdminMetrics): string {
  return [
    "📊 Relatório diário — BeautyConta",
    "",
    `👥 Usuárias: ${m.totalUsers} (+${m.newUsersToday} hoje)`,
    `🏪 Negócios: ${m.totalBusinesses}`,
    `📅 Agendamentos hoje: ${m.appointmentsToday}`,
    `⭐ Assinaturas ativas: ${m.activeSubscriptions}`,
    `🕐 ${brNow()}`,
  ].join("\n");
}

function brNow(): string {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
