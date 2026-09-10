import type { Notifier } from "../../application/ports/notifications";

/**
 * Notificador de espera, usado quando `TELEGRAM_BOT_TOKEN` e
 * `TELEGRAM_CHAT_ID` não estão definidos.
 *
 * Diferente do `NotConfiguredGateway`, este não recusa nada: quem chama é um
 * fluxo interno que não pediu o aviso, e recusar derrubaria um cadastro por
 * causa de configuração ausente. Falta de aviso é falta de aviso — o cadastro
 * acontece igual, e é assim que a suíte roda sem tocar em rede.
 */
export class SilentNotifier implements Notifier {
  notify(): Promise<void> {
    return Promise.resolve();
  }
}
