"use client";

import { useState } from "react";
import {
  CHANNEL_LABELS,
  PLAN_LABELS,
  SEGMENT_LABELS,
  WORK_MODEL_LABELS,
  churnRate,
  conversionRate,
  formatCents,
  formatDate,
  timeAgo,
  variation,
  type AdminActivity,
  type AdminBillingEvent,
  type AdminBusiness,
  type AdminMetrics,
  type AdminSettings,
} from "@/application/use-cases/admin-panel";
import { adminApi } from "@/infrastructure/admin/gateway";
import { AdminCard, AdminTable, useAdminData } from "./admin-shared";

/**
 * As telas do painel que leem dados e não editam nada.
 *
 * Ficam num arquivo próprio porque a tela principal já carrega a navegação, a
 * sessão e o formulário de preços — juntar tudo faria um arquivo em que ninguém
 * acha nada.
 */

/** Números do negócio: funil, receita e tendência de cadastro. */
export function MetricasTab({ onExpirar }: { onExpirar: () => void }) {
  const { data, erro } = useAdminData<AdminMetrics>(() => adminApi.metrics(), onExpirar);

  if (erro) return <p className="admin-erro">{erro}</p>;
  if (!data) return <p className="admin-loading">Carregando…</p>;

  const conversao = conversionRate(data.payers.current, data.leads.current);
  const churn = churnRate(data.churned, data.baseAtStart);
  const receita = variation(data.revenue.currentCents, data.revenue.previousCents);

  return (
    <>
      <section className="admin-cards" aria-label="Funil do mês">
        <AdminCard
          titulo="Contas novas"
          valor={String(data.leads.current)}
          nota={comparacao(data.leads.previous, variation(data.leads.current, data.leads.previous))}
        />
        <AdminCard
          titulo="Viraram assinantes"
          valor={String(data.payers.current)}
          nota={
            conversao === null ? "sem contas para comparar" : `${conversao}% das contas novas`
          }
        />
        <AdminCard
          titulo="Receita por mês"
          valor={formatCents(data.revenue.currentCents)}
          nota={comparacao(data.revenue.previousCents, receita, formatCents)}
        />
        <AdminCard
          titulo="Média por assinante"
          valor={formatCents(data.ticketCents)}
          nota="Anual dividida por 12"
        />
      </section>

      <section className="admin-cards" aria-label="Perdas">
        <AdminCard
          titulo="Assinaturas perdidas"
          valor={String(data.churned)}
          nota={churn === null ? "sem base para comparar" : `${churn}% da base do mês`}
          tom={churn !== null && churn > 10 ? "alerta" : undefined}
        />
        <AdminCard titulo="Base no início do mês" valor={String(data.baseAtStart)} />
      </section>

      <section aria-labelledby="serie">
        <h2 className="admin-h2" id="serie">
          Cadastros nos últimos 30 dias
        </h2>
        <SignupChart pontos={data.signups} />
      </section>
    </>
  );
}

/**
 * Cadastros por dia, em barras.
 *
 * Desenhado com `div`, e não com biblioteca de gráfico: são trinta barras e um
 * eixo, e carregar uma dependência inteira para isso pesaria mais do que o
 * painel.
 */
function SignupChart({ pontos }: { pontos: { date: string; count: number }[] }) {
  const maior = Math.max(1, ...pontos.map((ponto) => ponto.count));
  const total = pontos.reduce((soma, ponto) => soma + ponto.count, 0);

  return (
    <div className="admin-grafico">
      <div className="admin-barras" role="img" aria-label={`${total} cadastros em 30 dias`}>
        {pontos.map((ponto) => (
          <div key={ponto.date} className="admin-barra-caixa" title={`${ponto.date}: ${ponto.count}`}>
            {/* Altura mínima visível para o dia de zero não sumir: um vão no
                gráfico se lê como dado faltando, não como dia parado. */}
            <div
              className="admin-barra"
              style={{ height: `${Math.max(3, (ponto.count / maior) * 100)}%` }}
              data-vazio={ponto.count === 0}
            />
          </div>
        ))}
      </div>
      <p className="admin-nota">
        {total} no período · maior dia com {maior}
      </p>
    </div>
  );
}

function comparacao(
  anterior: number,
  variacao: number | null,
  formatar: (valor: number) => string = String,
): string {
  if (variacao === null) return `${formatar(anterior)} no mês passado`;

  const sinal = variacao > 0 ? "+" : "";
  return `${sinal}${variacao}% · ${formatar(anterior)} antes`;
}

/** Negócios cadastrados, com o que cada um já montou. */
export function NegociosTab({ onExpirar }: { onExpirar: () => void }) {
  const [busca, setBusca] = useState("");
  const [aplicada, setAplicada] = useState("");
  const { data, erro } = useAdminData(
    () => adminApi.businesses({ search: aplicada, limit: 100 }),
    onExpirar,
    [aplicada],
  );

  return (
    <>
      <form
        className="admin-busca"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setAplicada(busca.trim());
        }}
      >
        <label htmlFor="busca-negocio">Buscar por nome do estúdio ou e-mail</label>
        <input
          id="busca-negocio"
          type="search"
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
        />
        <button type="submit" className="admin-primary">
          Buscar
        </button>
      </form>

      {erro && <p className="admin-erro">{erro}</p>}
      {!data && !erro && <p className="admin-loading">Carregando…</p>}
      {data && data.items.length === 0 && <p className="admin-vazio">Nenhum negócio encontrado.</p>}

      {data && data.items.length > 0 && (
        <AdminTable
          legenda={`${data.total} negócios`}
          colunas={["Estúdio", "Segmento", "Agenda", "Cadastros", "Plano"]}
        >
          {data.items.map((item: AdminBusiness) => (
            <tr key={item.id}>
              <td>
                <strong>{item.name ?? "sem nome"}</strong>
                <span className="admin-sub">{item.ownerEmail}</span>
              </td>
              <td>
                {SEGMENT_LABELS[item.segment] ?? item.segment}
                <span className="admin-sub">{WORK_MODEL_LABELS[item.workModel] ?? item.workModel}</span>
              </td>
              <td>
                {item.bookingSlug ? (
                  <span className="admin-tag admin-tag-ok">/{item.bookingSlug}</span>
                ) : (
                  <span className="admin-sub">fechada</span>
                )}
              </td>
              <td>
                <span className="admin-sub">
                  {item.counts.services} serviços · {item.counts.materials} materiais
                </span>
                <span className="admin-sub">
                  {item.counts.calculations} cálculos · {item.counts.appointments} agendamentos
                </span>
              </td>
              <td>{PLAN_LABELS[item.plan] ?? item.plan}</td>
            </tr>
          ))}
        </AdminTable>
      )}
    </>
  );
}

/** O que aconteceu de mais recente — a resposta para "alguém está usando?". */
export function AtividadeTab({ onExpirar }: { onExpirar: () => void }) {
  const { data, erro } = useAdminData(() => adminApi.activity(), onExpirar);

  if (erro) return <p className="admin-erro">{erro}</p>;
  if (!data) return <p className="admin-loading">Carregando…</p>;
  if (data.items.length === 0) return <p className="admin-vazio">Nada aconteceu ainda.</p>;

  return (
    <>
      <p className="admin-nota">
        Só o que houve, nunca o conteúdo: o painel precisa saber que alguém calculou um preço, não
        quanto custa o serviço dela.
      </p>

      <ul className="admin-atividade">
        {data.items.map((item: AdminActivity, index: number) => (
          <li key={`${item.businessId}-${item.at}-${index}`}>
            <span className={`admin-ponto admin-ponto-${item.kind}`} aria-hidden="true" />
            <span>
              <strong>{item.label}</strong>
              <span className="admin-sub">{item.businessName ?? "negócio sem nome"}</span>
            </span>
            <time dateTime={item.at}>{timeAgo(item.at)}</time>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Eventos de cobrança e os sinais de falha silenciosa. */
export function CobrancaTab({ onExpirar }: { onExpirar: () => void }) {
  const [soPendentes, setSoPendentes] = useState(false);
  const { data, erro } = useAdminData(
    () => adminApi.billingLog(soPendentes),
    onExpirar,
    [soPendentes],
  );

  if (erro) return <p className="admin-erro">{erro}</p>;
  if (!data) return <p className="admin-loading">Carregando…</p>;

  return (
    <>
      <section className="admin-cards" aria-label="Saúde da cobrança">
        <AdminCard
          titulo="Não processados"
          valor={String(data.health.unprocessed)}
          nota="Cada um é um acesso que não mudou"
          tom={data.health.unprocessed > 0 ? "alerta" : undefined}
        />
        <AdminCard titulo="Nas últimas 24 h" valor={String(data.health.last24h)} />
        <AdminCard
          titulo="Vencidas ainda ativas"
          valor={String(data.health.staleActive)}
          nota="Plano pago sendo usado de graça"
          tom={data.health.staleActive > 0 ? "alerta" : undefined}
        />
        <AdminCard
          titulo="Em carência"
          valor={String(data.health.inGrace)}
          nota="Cobrança falhou, provedor tentando"
        />
      </section>

      <div className="admin-filtros">
        <button
          type="button"
          className="admin-tab"
          aria-pressed={!soPendentes}
          onClick={() => setSoPendentes(false)}
        >
          Todos
        </button>
        <button
          type="button"
          className="admin-tab"
          aria-pressed={soPendentes}
          onClick={() => setSoPendentes(true)}
        >
          Só os não processados
        </button>
      </div>

      {data.events.length === 0 ? (
        <p className="admin-vazio">Nenhum evento de cobrança recebido.</p>
      ) : (
        <AdminTable
          legenda={`${data.events.length} eventos`}
          colunas={["Origem", "Tipo", "Recebido", "Processado"]}
        >
          {data.events.map((event: AdminBillingEvent) => (
            <tr key={event.id}>
              <td>{CHANNEL_LABELS[event.source] ?? event.source}</td>
              <td>
                {event.type}
                {!event.businessId && <span className="admin-sub">sem negócio identificado</span>}
              </td>
              <td>
                {formatDate(event.createdAt)}
                <span className="admin-sub">{timeAgo(event.createdAt)}</span>
              </td>
              <td>
                {event.processedAt ? (
                  <span className="admin-tag admin-tag-ok">sim</span>
                ) : (
                  <span className="admin-tag admin-tag-warn">não</span>
                )}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </>
  );
}

/** O que está ligado neste servidor. Nenhum segredo aparece aqui. */
export function ConfiguracaoTab({ onExpirar }: { onExpirar: () => void }) {
  const { data, erro } = useAdminData<AdminSettings>(() => adminApi.settings(), onExpirar);

  if (erro) return <p className="admin-erro">{erro}</p>;
  if (!data) return <p className="admin-loading">Carregando…</p>;

  const linhas: { label: string; ligado: boolean; detalhe: string }[] = [
    {
      label: "Checkout do Mercado Pago",
      ligado: data.billing.mercadoPago,
      detalhe: data.billing.mercadoPago
        ? "Cartão e Pix funcionando"
        : "Falta MERCADO_PAGO_ACCESS_TOKEN — ninguém consegue assinar",
    },
    {
      label: "Segredo do painel",
      ligado: data.admin.hasSecret,
      detalhe: data.admin.hasSecret ? "Configurado" : "Só a entrada por sessão está valendo",
    },
    {
      label: "Administradoras por sessão",
      ligado: data.admin.emails > 0,
      detalhe:
        data.admin.emails > 0 ? `${data.admin.emails} e-mail(s) na lista` : "ADMIN_EMAILS vazio",
    },
    {
      label: "Preços de partida no ambiente",
      ligado: data.seedPrices > 0,
      detalhe:
        data.seedPrices > 0
          ? `${data.seedPrices} oferta(s) em PLAN_PRICES`
          : "Nenhuma — os preços vêm só do banco",
    },
  ];

  return (
    <>
      <p className="admin-nota">
        Esta tela diz o que está ligado, e nunca com qual credencial. Um painel que mostra segredo é
        um painel que os entrega a quem conseguir abri-lo.
      </p>

      <ul className="admin-lista">
        {linhas.map((linha) => (
          <li key={linha.label}>
            <span>
              <strong>{linha.label}</strong>
              <span className="admin-sub">{linha.detalhe}</span>
            </span>
            <span className={`admin-tag admin-tag-${linha.ligado ? "ok" : "warn"}`}>
              {linha.ligado ? "ligado" : "faltando"}
            </span>
          </li>
        ))}
      </ul>

      <h2 className="admin-h2">Documentos</h2>
      <ul className="admin-lista">
        <li>
          <span>Termos de Uso</span>
          <a href={data.legal.termsUrl} target="_blank" rel="noreferrer" className="admin-link">
            abrir
          </a>
        </li>
        <li>
          <span>Política de Privacidade</span>
          <a href={data.legal.privacyUrl} target="_blank" rel="noreferrer" className="admin-link">
            abrir
          </a>
        </li>
        <li>
          <span>Contato de suporte</span>
          <span className="admin-sub">{data.legal.supportEmail}</span>
        </li>
      </ul>
    </>
  );
}
