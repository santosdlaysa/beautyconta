"use client";

import { useCallback, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  CHANNEL_LABELS,
  PERIOD_LABELS,
  PLAN_LABELS,
  STATUS_LABELS,
  centsToInput,
  formatCents,
  formatDate,
  daysWaiting,
  DELETION_STATUS_LABELS,
  parsePriceToCents,
  subscriptionTone,
  validateOfferPrice,
  type AdminDeletionRequest,
  type AdminOffer,
  type AdminOverview,
  type AdminSubscription,
  type AdminUser,
} from "@/application/use-cases/admin-panel";
import {
  AdminAuthError,
  adminApi,
  clearSecret,
  hasSecret,
  hasSecretOnServer,
  saveSecret,
  subscribeToSecret,
} from "@/infrastructure/admin/gateway";
import { AdminCard, useAdminData } from "./admin-shared";
import {
  AtividadeTab,
  CobrancaTab,
  ConfiguracaoTab,
  MetricasTab,
  NegociosTab,
} from "./admin-tabs";

type Aba =
  | "resumo"
  | "metricas"
  | "atividade"
  | "assinantes"
  | "usuarias"
  | "negocios"
  | "planos"
  | "cobranca"
  | "exclusoes"
  | "configuracao";

/**
 * A navegação, agrupada por assunto.
 *
 * `section` marca onde um grupo começa; os itens seguintes pertencem a ele até
 * o próximo. O agrupamento importa porque "conferir números" e "mexer em preço"
 * são visitas diferentes, e misturá-las faz procurar cada vez.
 */
const ABAS: { id: Aba; label: string; icon: IconName; section?: string }[] = [
  { id: "resumo", label: "Resumo", icon: "chart" },
  { id: "metricas", label: "Números do negócio", icon: "trend" },
  { id: "atividade", label: "Atividade", icon: "clock" },

  { id: "usuarias", label: "Usuárias", icon: "user", section: "Cadastro" },
  { id: "negocios", label: "Negócios", icon: "store" },
  { id: "assinantes", label: "Assinantes", icon: "coin" },

  { id: "planos", label: "Planos e preços", icon: "sparkle", section: "Configuração" },
  { id: "cobranca", label: "Cobrança", icon: "coin" },
  { id: "exclusoes", label: "Exclusões de conta", icon: "alert" },
  { id: "configuracao", label: "Integrações", icon: "gear" },
];

type IconName = "chart" | "coin" | "user" | "sparkle" | "alert" | "trend" | "clock" | "store" | "gear";

/** Ícones do painel. Traço fino, como o resto do produto. */
function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    chart: "M4 3v17h17M8 15l4-5 4 2 5-7",
    coin: "M12 3v18M8 7.5h5.5a2.5 2.5 0 0 1 0 5H10a2.5 2.5 0 0 0 0 5H16",
    user: "M4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z",
    sparkle: "M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9L4.5 10.8 10.2 9 12 3.5Z",
    alert: "M12 3.5 21 19H3l9-15.5ZM12 10v4m0 3h.01",
    trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
    clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
    store: "M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9ZM3 9l1.5-5h15L21 9M9 20v-6h6v6",
    gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2m10-10 2-2",
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="17"
      height="17"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function AdminPanel() {
  const [aba, setAba] = useState<Aba>("resumo");
  const [menuAberto, setMenuAberto] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  /**
   * A sessão vem do próprio guardião do segredo, e não de uma cópia em estado.
   *
   * Duas verdades sobre "estou autenticada" abrem uma janela em que elas
   * discordam — e a que importa é sempre a do armazenamento, porque é ela que
   * decide se a próxima requisição leva credencial.
   */
  const autenticada = useSyncExternalStore(subscribeToSecret, hasSecret, hasSecretOnServer);

  const sair = useCallback(() => {
    setSessionError(null);
    clearSecret();
  }, []);

  const expirar = useCallback(() => {
    setSessionError("O servidor recusou seu acesso. Confira o segredo e entre novamente.");
    clearSecret();
  }, []);

  if (!autenticada) return <AdminLogin sessionError={sessionError} />;

  const atual = ABAS.find((item) => item.id === aba);

  return (
    <div className="admin-shell">
      {/* No celular a barra vira gaveta; o botão só existe lá. */}
      <button
        type="button"
        className="admin-menu"
        aria-expanded={menuAberto}
        aria-controls="admin-nav"
        onClick={() => setMenuAberto((aberto) => !aberto)}
      >
        <span aria-hidden="true">☰</span> {atual?.label ?? "Painel"}
      </button>

      <aside id="admin-nav" className="admin-side" data-aberta={menuAberto}>
        <div className="admin-marca">
          <span className="admin-marca-selo" aria-hidden="true">B</span>
          <span>
            <strong>BeautyConta</strong>
            <small>Painel</small>
          </span>
        </div>

        <nav className="admin-nav" aria-label="Seções do painel">
          {ABAS.map((item) => (
            <div key={item.id}>
              {item.section && <p className="admin-nav-secao">{item.section}</p>}
              <button
                type="button"
                className="admin-nav-item"
                aria-current={aba === item.id ? "page" : undefined}
                onClick={() => {
                  setAba(item.id);
                  setMenuAberto(false);
                }}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </button>
            </div>
          ))}
        </nav>

        <button type="button" className="admin-sair" onClick={sair}>
          Sair
        </button>
      </aside>

      <main className="admin-conteudo">
        <h1 className="admin-titulo">{atual?.label}</h1>

        {aba === "resumo" && <ResumoTab onExpirar={expirar} />}
        {aba === "planos" && <PlanosTab onExpirar={expirar} />}
        {aba === "assinantes" && <AssinantesTab onExpirar={expirar} />}
        {aba === "usuarias" && <UsuariasTab onExpirar={expirar} />}
        {aba === "exclusoes" && <ExclusoesTab onExpirar={expirar} />}
        {aba === "metricas" && <MetricasTab onExpirar={expirar} />}
        {aba === "atividade" && <AtividadeTab onExpirar={expirar} />}
        {aba === "negocios" && <NegociosTab onExpirar={expirar} />}
        {aba === "cobranca" && <CobrancaTab onExpirar={expirar} />}
        {aba === "configuracao" && <ConfiguracaoTab onExpirar={expirar} />}
      </main>
    </div>
  );
}

function AdminLogin({ sessionError }: { sessionError: string | null }) {
  const [secret, setSecret] = useState("");
  const [erro, setErro] = useState<string | null>(sessionError);
  const [entrando, setEntrando] = useState(false);

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    if (!secret.trim() || entrando) return;

    setEntrando(true);
    setErro(null);

    // O segredo é conferido contra o servidor antes de a tela abrir: guardar e
    // acreditar deixaria a pessoa navegando num painel que falha em tudo.
    try {
      await adminApi.verifySecret(secret.trim());
      saveSecret(secret.trim());
    } catch (falha) {
      setErro(falha instanceof AdminAuthError ? "Segredo inválido." : (falha as Error).message);
    } finally {
      setEntrando(false);
    }
  };

  return (
    <form className="admin-login" onSubmit={enviar}>
      <div className="admin-login-marca">
        <span className="admin-marca-selo" aria-hidden="true">B</span>
        <span>BeautyConta</span>
      </div>
      <h1>Painel administrativo</h1>
      <label htmlFor="admin-secret">Segredo de acesso</label>
      <input
        id="admin-secret"
        type="password"
        value={secret}
        onChange={(event) => setSecret(event.target.value)}
        autoComplete="off"
        autoFocus
      />
      {erro && <p className="admin-erro">{erro}</p>}
      <button type="submit" className="admin-primary" disabled={entrando}>
        {entrando ? "Conferindo…" : "Entrar"}
      </button>
    </form>
  );
}

function ResumoTab({ onExpirar }: { onExpirar: () => void }) {
  const { data, erro } = useAdminData<AdminOverview>(() => adminApi.overview(), onExpirar);

  if (erro) return <p className="admin-erro">{erro}</p>;
  if (!data) return <p className="admin-loading">Carregando…</p>;

  return (
    <>
      <section className="admin-cards" aria-label="Números do negócio">
        <AdminCard titulo="Contas" valor={String(data.users.total)} nota={`+${data.users.today} hoje`} />
        <AdminCard
          titulo="Em 30 dias"
          valor={String(data.users.last30Days)}
          nota={`${data.users.last7Days} nos últimos 7`}
        />
        <AdminCard
          titulo="Assinaturas ativas"
          valor={String(data.subscriptions.active)}
          nota={`${data.businesses.total} negócios`}
        />
        <AdminCard
          titulo="Receita por mês"
          valor={formatCents(data.revenue.monthlyRecurringCents)}
          nota="Anual dividida por 12"
        />
      </section>

      <section className="admin-cards" aria-label="Uso do produto">
        <AdminCard titulo="Serviços" valor={String(data.usage.services)} />
        <AdminCard titulo="Materiais" valor={String(data.usage.materials)} />
        <AdminCard titulo="Cálculos" valor={String(data.usage.calculations)} />
        <AdminCard titulo="Agendamentos" valor={String(data.usage.appointments)} />
      </section>

      <section aria-label="Onde as assinaturas foram compradas">
        <h2 className="admin-h2">Por canal</h2>
        {Object.keys(data.subscriptions.byChannel).length === 0 ? (
          <p className="admin-vazio">Nenhuma assinatura ativa ainda.</p>
        ) : (
          <ul className="admin-lista">
            {Object.entries(data.subscriptions.byChannel).map(([canal, quantas]) => (
              <li key={canal}>
                <span>{CHANNEL_LABELS[canal] ?? canal}</span>
                <strong>{quantas}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="admin-nota">
        A agenda pública está aberta em {data.businesses.withBookingOpen} de {data.businesses.total}{" "}
        negócios.
      </p>
    </>
  );
}

function PlanosTab({ onExpirar }: { onExpirar: () => void }) {
  const { data, erro, recarregar } = useAdminData(() => adminApi.plans(), onExpirar);

  if (erro) return <p className="admin-erro">{erro}</p>;
  if (!data) return <p className="admin-loading">Carregando…</p>;

  const existentes = new Map(data.offers.map((offer) => [`${offer.plan}:${offer.billingPeriod}`, offer]));

  const combinacoes: { plan: "PREMIUM" | "MASTER"; billingPeriod: "MONTHLY" | "ANNUAL" }[] = [
    { plan: "PREMIUM", billingPeriod: "MONTHLY" },
    { plan: "PREMIUM", billingPeriod: "ANNUAL" },
    { plan: "MASTER", billingPeriod: "MONTHLY" },
    { plan: "MASTER", billingPeriod: "ANNUAL" },
  ];

  return (
    <>
      <p className="admin-nota">
        Estes valores valem para a venda pelo site — cartão com renovação automática e Pix avulso.
        Nas lojas quem manda no preço é a App Store e o Google Play, onde o valor é definido no
        console delas.
      </p>

      <div className="admin-planos">
        {combinacoes.map((combo) => (
          <OfferForm
            key={`${combo.plan}:${combo.billingPeriod}`}
            plan={combo.plan}
            billingPeriod={combo.billingPeriod}
            existente={existentes.get(`${combo.plan}:${combo.billingPeriod}`) ?? null}
            onSalvo={recarregar}
            onExpirar={onExpirar}
          />
        ))}
      </div>
    </>
  );
}

function OfferForm({
  plan,
  billingPeriod,
  existente,
  onSalvo,
  onExpirar,
}: {
  plan: "PREMIUM" | "MASTER";
  billingPeriod: "MONTHLY" | "ANNUAL";
  existente: AdminOffer | null;
  onSalvo: () => void;
  onExpirar: () => void;
}) {
  const [preco, setPreco] = useState(existente ? centsToInput(existente.priceCents) : "");
  const [ativo, setAtivo] = useState(existente?.isActive ?? true);
  const [beneficios, setBeneficios] = useState((existente?.benefits ?? []).join("\n"));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    if (salvando) return;

    const centavos = parsePriceToCents(preco);
    const invalido = validateOfferPrice(centavos);
    if (invalido || centavos === null) {
      setErro(invalido);
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      await adminApi.saveOffer({
        plan,
        billingPeriod,
        priceCents: centavos,
        isActive: ativo,
        benefits: beneficios
          .split("\n")
          .map((linha) => linha.trim())
          .filter(Boolean),
      });
      setSalvo(true);
      onSalvo();
    } catch (falha) {
      if (falha instanceof AdminAuthError) {
        onExpirar();
        return;
      }
      setErro((falha as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const remover = async () => {
    if (!existente) return;

    try {
      await adminApi.deleteOffer(plan, billingPeriod);
      setPreco("");
      onSalvo();
    } catch (falha) {
      if (falha instanceof AdminAuthError) onExpirar();
      else setErro((falha as Error).message);
    }
  };

  const centavos = parsePriceToCents(preco);

  return (
    <form className="admin-plano" onSubmit={salvar}>
      <h3>
        {PLAN_LABELS[plan]} · {PERIOD_LABELS[billingPeriod]}
      </h3>

      <label htmlFor={`preco-${plan}-${billingPeriod}`}>Preço</label>
      <div className="admin-preco">
        <span aria-hidden="true">R$</span>
        <input
          id={`preco-${plan}-${billingPeriod}`}
          inputMode="decimal"
          value={preco}
          placeholder="29,90"
          onChange={(event) => {
            setPreco(event.target.value);
            setSalvo(false);
            setErro(null);
          }}
        />
      </div>

      {/* O valor lido de volta, para a pessoa conferir o que será cobrado antes
          de salvar — é onde um ponto no lugar da vírgula aparece. */}
      {centavos !== null && preco.trim() !== "" && (
        <p className="admin-preview">Será cobrado {formatCents(centavos)}</p>
      )}

      <label htmlFor={`beneficios-${plan}-${billingPeriod}`}>Benefícios, um por linha</label>
      <textarea
        id={`beneficios-${plan}-${billingPeriod}`}
        rows={4}
        value={beneficios}
        placeholder="Serviços e materiais sem limite"
        onChange={(event) => {
          setBeneficios(event.target.value);
          setSalvo(false);
        }}
      />

      <label className="admin-check">
        <input
          type="checkbox"
          checked={ativo}
          onChange={(event) => {
            setAtivo(event.target.checked);
            setSalvo(false);
          }}
        />
        À venda
      </label>

      {erro && <p className="admin-erro">{erro}</p>}
      {salvo && !erro && <p className="admin-ok">Salvo.</p>}

      <div className="admin-acoes">
        <button type="submit" className="admin-primary" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        {existente && (
          <button type="button" className="admin-link" onClick={remover}>
            Remover
          </button>
        )}
      </div>
    </form>
  );
}

function AssinantesTab({ onExpirar }: { onExpirar: () => void }) {
  const { data, erro } = useAdminData(() => adminApi.subscriptions({ limit: 100 }), onExpirar);

  if (erro) return <p className="admin-erro">{erro}</p>;
  if (!data) return <p className="admin-loading">Carregando…</p>;
  if (data.items.length === 0) return <p className="admin-vazio">Nenhuma assinatura ainda.</p>;

  return (
    <div className="admin-tabela-wrap">
      <table className="admin-tabela">
        <caption>{data.total} assinaturas</caption>
        <thead>
          <tr>
            <th scope="col">Negócio</th>
            <th scope="col">Plano</th>
            <th scope="col">Situação</th>
            <th scope="col">Canal</th>
            <th scope="col">Até</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item: AdminSubscription) => (
            <tr key={item.id}>
              <td>
                <strong>{item.businessName ?? "—"}</strong>
                <span className="admin-sub">{item.ownerEmail}</span>
              </td>
              <td>
                {PLAN_LABELS[item.plan] ?? item.plan}
                <span className="admin-sub">{PERIOD_LABELS[item.billingPeriod] ?? item.billingPeriod}</span>
              </td>
              <td>
                <span className={`admin-tag admin-tag-${subscriptionTone(item)}`}>
                  {STATUS_LABELS[item.status] ?? item.status}
                  {item.cancelAtPeriodEnd && item.status === "active" ? " · não renova" : ""}
                </span>
              </td>
              <td>{CHANNEL_LABELS[item.channel] ?? item.channel}</td>
              <td>{item.currentPeriodEnd ? formatDate(item.currentPeriodEnd) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsuariasTab({ onExpirar }: { onExpirar: () => void }) {
  const [busca, setBusca] = useState("");
  const [aplicada, setAplicada] = useState("");
  const { data, erro } = useAdminData(
    () => adminApi.users({ search: aplicada, limit: 100 }),
    onExpirar,
  );

  // A busca só dispara ao enviar: filtrar a cada tecla mandaria uma requisição
  // por letra digitada.
  const buscar = (event: FormEvent) => {
    event.preventDefault();
    setAplicada(busca.trim());
  };

  return (
    <>
      <form className="admin-busca" onSubmit={buscar} role="search">
        <label htmlFor="admin-busca">Buscar por nome ou e-mail</label>
        <input
          id="admin-busca"
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

      {data && data.items.length === 0 && <p className="admin-vazio">Nenhuma conta encontrada.</p>}

      {data && data.items.length > 0 && (
        <div className="admin-tabela-wrap">
          <table className="admin-tabela">
            <caption>{data.total} contas</caption>
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Negócio</th>
                <th scope="col">Plano</th>
                <th scope="col">Desde</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item: AdminUser) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    <span className="admin-sub">{item.email}</span>
                  </td>
                  <td>{item.businessName ?? "—"}</td>
                  <td>{PLAN_LABELS[item.plan] ?? item.plan}</td>
                  <td>{formatDate(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/**
 * Pedidos de exclusão de conta.
 *
 * Quem chega aqui é quem **não conseguiu entrar** no aplicativo — quem entra
 * apaga a própria conta na hora. Marcar como tratado **não apaga nada**: a
 * exclusão exige confirmar que quem pediu é a dona do e-mail, e essa conferência
 * é humana.
 */
function ExclusoesTab({ onExpirar }: { onExpirar: () => void }) {
  const [filtro, setFiltro] = useState<"pending" | "all">("pending");
  const { data, erro, recarregar } = useAdminData(
    () => adminApi.deletionRequests(filtro === "pending" ? "pending" : undefined),
    onExpirar,
    [filtro],
  );

  const [tratando, setTratando] = useState<string | null>(null);

  const tratar = async (id: string, status: "done" | "rejected") => {
    setTratando(id);
    try {
      await adminApi.resolveDeletionRequest(id, status);
      recarregar();
    } catch (falha) {
      if (falha instanceof AdminAuthError) onExpirar();
    } finally {
      setTratando(null);
    }
  };

  if (erro) return <p className="admin-erro">{erro}</p>;
  if (!data) return <p className="admin-loading">Carregando…</p>;

  return (
    <>
      <p className="admin-nota">
        Confirme a identidade de quem pediu antes de apagar — e lembre que há prazo legal para
        responder. Marcar aqui registra o desfecho; a exclusão em si você faz pelo caminho de sempre.
      </p>

      <div className="admin-filtros">
        <button
          type="button"
          className="admin-tab"
          aria-pressed={filtro === "pending"}
          onClick={() => setFiltro("pending")}
        >
          Aguardando
        </button>
        <button
          type="button"
          className="admin-tab"
          aria-pressed={filtro === "all"}
          onClick={() => setFiltro("all")}
        >
          Todos
        </button>
      </div>

      {data.items.length === 0 ? (
        <p className="admin-vazio">
          {filtro === "pending" ? "Nada aguardando." : "Nenhum pedido até agora."}
        </p>
      ) : (
        <div className="admin-tabela-wrap">
          <table className="admin-tabela">
            <caption>{data.items.length} pedidos</caption>
            <thead>
              <tr>
                <th scope="col">E-mail</th>
                <th scope="col">Pedido</th>
                <th scope="col">Situação</th>
                <th scope="col">Ação</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item: AdminDeletionRequest) => {
                const dias = daysWaiting(item);

                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.email}</strong>
                      {item.note && <span className="admin-sub">{item.note}</span>}
                    </td>
                    <td>
                      {formatDate(item.createdAt)}
                      {item.status === "pending" && (
                        // Quem esperou mais é quem está mais perto do prazo.
                        <span className={`admin-sub${dias >= 15 ? " admin-atrasado" : ""}`}>
                          {dias === 0 ? "hoje" : `há ${dias} dia${dias > 1 ? "s" : ""}`}
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`admin-tag admin-tag-${item.status === "pending" ? "warn" : "off"}`}
                      >
                        {DELETION_STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </td>
                    <td>
                      {item.status === "pending" ? (
                        <div className="admin-acoes">
                          <button
                            type="button"
                            className="admin-link"
                            disabled={tratando === item.id}
                            onClick={() => void tratar(item.id, "done")}
                          >
                            Apagada
                          </button>
                          <button
                            type="button"
                            className="admin-link"
                            disabled={tratando === item.id}
                            onClick={() => void tratar(item.id, "rejected")}
                          >
                            Recusar
                          </button>
                        </div>
                      ) : (
                        <span className="admin-sub">
                          {item.handledAt ? formatDate(item.handledAt) : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

