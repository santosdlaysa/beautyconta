import cron from "node-cron";
import { createApp } from "./app";
import { env } from "./config/env";
import { createDependencies } from "./infrastructure/container";
import { SendDailyReport } from "./application/use-cases/admin-report";

const deps = createDependencies();

createApp(deps).listen(env.port, () => {
  console.log(`API do BeautyConta em http://localhost:${env.port}`);
});

scheduleDailyReport();

/**
 * Relatório diário no Telegram.
 *
 * Mora aqui, e não em `createApp`, de propósito: a suíte monta a aplicação
 * dezenas de vezes por execução, e um agendador dentro dela deixaria relógios
 * pendurados a cada teste — além de fazer a suíte tentar falar com o Telegram.
 * Quem sobe processo agenda; quem só monta a API, não.
 *
 * O agendamento depende do Telegram estar configurado. Sem token nem destino, o
 * `SilentNotifier` descartaria a mensagem de qualquer forma, e consultar cinco
 * contagens no banco todo dia para jogar fora seria trabalho puro.
 *
 * Aviso para quando a hospedagem crescer: com mais de uma instância do processo,
 * cada uma dispara o seu relatório e a mesma mensagem chega repetida. No plano
 * atual do Render é uma instância só; se isso mudar, o agendamento precisa sair
 * daqui para um worker único ou um cron externo.
 */
function scheduleDailyReport(): void {
  const { botToken, chatId, dailyReportCron } = env.telegram;
  if (!botToken || !chatId) return;

  if (!cron.validate(dailyReportCron)) {
    console.warn(
      `[telegram] TELEGRAM_DAILY_REPORT_CRON inválido ("${dailyReportCron}"): ` +
        "relatório diário desligado.",
    );
    return;
  }

  const report = new SendDailyReport(deps.metrics, deps.notifier, deps.clock);

  cron.schedule(
    dailyReportCron,
    () => {
      // O relatório lê o banco, que pode estar fora do ar. Sem este `catch`, a
      // rejeição subiria como unhandled e derrubaria o processo inteiro por
      // causa de um relatório — trocando um aviso perdido pela API fora do ar.
      void report.execute().catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`[telegram] relatório diário falhou: ${reason}`);
      });
    },
    { timezone: "America/Sao_Paulo" },
  );

  console.log(`[telegram] relatório diário agendado (${dailyReportCron}, America/Sao_Paulo)`);
}
