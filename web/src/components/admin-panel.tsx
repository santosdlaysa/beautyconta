"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  CHANNEL_LABELS,
  PERIOD_LABELS,
  PLAN_LABELS,
  STATUS_LABELS,
  centsToInput,
  formatCents,
  formatDate,
  parsePriceToCents,
  subscriptionTone,
  validateOfferPrice,
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

type Aba = "resumo" | "planos" | "assinantes" | "usuarias";

const ABAS: { id: Aba; label: string }[] = [
  { id: "resumo", label: "Resumo" },
  { id: "planos", label: "Planos e preços" },
  { id: "assinantes", label: "Assinantes" },
  { id: "usuarias", label: "Usuárias" },
];

export function AdminPanel() {
  const [aba, setAba] = useState<Aba>("resumo");

  /**
   * A sessão vem do próprio guardião do segredo, e não de uma cópia em estado.
   *
   * Duas verdades sobre "estou autenticada" abrem uma janela em que elas
   * discordam — e a que importa é sempre a do armazenamento, porque é ela que
   * decide se a próxima requisição leva credencial.
   */
  const autenticada = useSyncExternalStore(subscribeToSecret, hasSecret, hasSecretOnServer);

  const sair = useCallback(() => {
    clearSecret();
  }, []);

  if (!autenticada) return <AdminLogin />;

  return (
    <div className="admin">
      <header className="admin-top">
        <strong>BeautyConta · Painel</strong>
        <button type="button" className="admin-link" onClick={sair}>
          Sair
        </button>
      </header>

      <nav className="admin-tabs" aria-label="Seções do painel">
        {ABAS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="admin-tab"
            aria-pressed={aba === item.id}
            onClick={() => setAba(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main className="admin-body">
        {aba === "resumo" && <ResumoTab onExpirar={sair} />}
        {aba === "planos" && <PlanosTab onExpirar={sair} />}
        {aba === "assinantes" && <AssinantesTab onExpirar={sair} />}
        {aba === "usuarias" && <UsuariasTab onExpirar={sair} />}
      </main>
    </div>
  );
}

function AdminLogin() {
  const [secret, setSecret] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    if (!secret.trim() || entrando) return;

    setEntrando(true);
    setErro(null);
    saveSecret(secret.trim());

    // O segredo é conferido contra o servidor antes de a tela abrir: guardar e
    // acreditar deixaria a pessoa navegando num painel que falha em tudo.
    try {
      // Guardar o segredo já avisa a tela: o painel abre porque o armazenamento
      // mudou, não porque alguém disse que abriu.
      await adminApi.overview();
    } catch (falha) {
      clearSecret();
      setErro(falha instanceof AdminAuthError ? "Segredo inválido." : (falha as Error).message);
    } finally {
      setEntrando(false);
    }
  };

  return (
    <form className="admin-login" onSubmit={enviar}>
      <h1>Painel do BeautyConta</h1>
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

/** Carrega dados da API e cuida do 401 de forma uniforme. */
function useAdminData<T>(carregar: () => Promise<T>, onExpirar: () => void) {
  const [data, setData] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;

    carregar()
      .then((resultado) => {
        if (ativo) setData(resultado);
      })
      .catch((falha: unknown) => {
        if (!ativo) return;
        if (falha instanceof AdminAuthError) {
          onExpirar();
          return;
        }
        setErro((falha as Error).message);
      });

    return () => {
      ativo = false;
    };
    // `carregar` muda a cada render por ser uma closure; a versão é o gatilho
    // explícito de recarga, e depender dela evita o laço infinito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao]);

  return { data, erro, recarregar: () => setVersao((v) => v + 1) };
}

function ResumoTab({ onExpirar }: { onExpirar: () => void }) {
  const { data, erro } = useAdminData<AdminOverview>(() => adminApi.overview(), onExpirar);

  if (erro) return <p className="admin-erro">{erro}</p>;
  if (!data) return <p className="admin-loading">Carregando…</p>;

  return (
    <>
      <section className="admin-cards" aria-label="Números do negócio">
        <Card titulo="Contas" valor={String(data.users.total)} nota={`+${data.users.today} hoje`} />
        <Card
          titulo="Em 30 dias"
          valor={String(data.users.last30Days)}
          nota={`${data.users.last7Days} nos últimos 7`}
        />
        <Card
          titulo="Assinaturas ativas"
          valor={String(data.subscriptions.active)}
          nota={`${data.businesses.total} negócios`}
        />
        <Card
          titulo="Receita por mês"
          valor={formatCents(data.revenue.monthlyRecurringCents)}
          nota="Anual dividida por 12"
        />
      </section>

      <section className="admin-cards" aria-label="Uso do produto">
        <Card titulo="Serviços" valor={String(data.usage.services)} />
        <Card titulo="Materiais" valor={String(data.usage.materials)} />
        <Card titulo="Cálculos" valor={String(data.usage.calculations)} />
        <Card titulo="Agendamentos" valor={String(data.usage.appointments)} />
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

function Card({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="admin-card">
      <span className="admin-card-titulo">{titulo}</span>
      <strong className="admin-card-valor">{valor}</strong>
      {nota && <span className="admin-card-nota">{nota}</span>}
    </div>
  );
}
