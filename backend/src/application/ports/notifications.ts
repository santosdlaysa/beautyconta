import type { AdminMetrics } from "./repositories";

/**
 * Porta de avisos administrativos.
 *
 * O destinatário aqui não é a usuária do BeautyConta: é quem cuida do produto,
 * que precisa saber de cadastro novo, assinatura e erro sem ficar olhando o
 * registro do servidor. Por isso o aviso é um evento nomeado e não um texto
 * pronto — a aplicação relata o que aconteceu, e é o adaptador que decide como
 * aquilo vira mensagem. Trocar Telegram por e-mail depois é escrever outro
 * adaptador, sem tocar em nenhum caso de uso.
 *
 * Todo aviso é acessório ao fluxo que o disparou. Um cadastro não pode falhar
 * porque o Telegram estava fora do ar, então a implementação engole os próprios
 * erros — ver `TelegramNotifier`.
 */
export type AdminNotice =
  | { kind: "new_user"; name: string; email: string }
  /**
   * Pedido de exclusão de conta vindo do site.
   *
   * É o aviso que faz o pedido chegar a alguém: sem ele o registro ficaria no
   * banco esperando que alguém lembrasse de olhar — e há prazo legal para
   * responder.
   */
  | {
      kind: "account_deletion_request";
      email: string;
      note: string | null;
      requestedAt: Date;
    }
  | {
      kind: "subscription";
      businessName: string | null;
      /** Tipo do evento como o provedor o nomeia, ex.: `INITIAL_PURCHASE`. */
      eventType: string;
      plan: string | null;
      channel: string | null;
    }
  | {
      kind: "server_error";
      method: string;
      path: string;
      statusCode: number;
      detail: string | null;
    }
  | { kind: "daily_report"; metrics: AdminMetrics };

export interface Notifier {
  notify(notice: AdminNotice): Promise<void>;
}
