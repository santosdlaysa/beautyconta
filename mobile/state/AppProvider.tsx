import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { track } from '../lib/analytics';
import { ApiError } from '../lib/api';
import { forgetCalculation, readCalculation } from '../lib/anonymous';
import { forgetDraft } from '../lib/onboarding';
import * as api from '../lib/resources';

/**
 * Estado do aplicativo.
 *
 * Um provedor só, porque os dados do BeautyConta são poucos e todos giram em
 * torno do mesmo negócio: sessão, cadastro do negócio e os catálogos da
 * usuária. As telas nunca chamam a API direto — pedem uma ação daqui, que
 * atualiza o servidor e o estado local na mesma operação.
 *
 * O que ainda não passa por aqui: clientes, que não tem API — o backlog o coloca
 * fora do MVP — e segue como demonstração na tela. Equipamentos tem API e
 * continua de fora, mesmo depois de a reserva para reposição entrar no custo
 * fixo: quem soma a reserva no preço é o servidor, e o resultado do cálculo já
 * volta com a composição pronta. Carregar a lista na abertura custaria uma
 * requisição a quem nunca abrir aquela tela para não mostrar nada de novo.
 */

const SESSION_KEY = 'beautyconta.session.token';

export type Status = 'loading' | 'signed-out' | 'onboarding' | 'ready';

type State = {
  status: Status;
  user: api.User | null;
  business: api.Business | null;
  settings: api.Settings | null;
  subscription: api.SubscriptionStatus | null;
  services: api.Service[];
  materials: api.Material[];
  fixedCosts: api.FixedCost[];
  calculations: api.Calculation[];
  /** Existem cálculos além da janela do plano; nenhum foi apagado (`F-01`). */
  calculationsLimitedByPlan: boolean;
  /** Atendimentos do dia escolhido na agenda, já ordenados por horário. */
  appointments: api.Appointment[];
  /** Resumo do mesmo dia: combinado, recebido e o que falta entrar. */
  daySummary: api.DaySummary | null;
  /**
   * Atendimentos do mês corrente inteiro, para o relatório da Home.
   *
   * Carregados à parte dos do dia porque respondem outra pergunta: o dia é
   * "o que tenho pela frente", o mês é "como está indo". A API já aceita
   * período, então isso não custa rota nova.
   */
  monthAppointments: api.Appointment[];
  /** Dia que a agenda está mostrando. */
  agendaDay: Date;
  /** O cálculo feito antes do cadastro acabou de entrar no histórico (`D-03`). */
  migratedCalculation: api.Calculation | null;
  /** Falha ao carregar os dados; a tela mostra e oferece tentar de novo. */
  loadError: string | null;
};

const empty: State = {
  status: 'loading',
  user: null,
  business: null,
  settings: null,
  subscription: null,
  services: [],
  materials: [],
  fixedCosts: [],
  calculations: [],
  calculationsLimitedByPlan: false,
  appointments: [],
  daySummary: null,
  monthAppointments: [],
  agendaDay: new Date(),
  migratedCalculation: null,
  loadError: null,
};

type Actions = {
  signUp(input: { name: string; email: string; password: string }): Promise<void>;
  signIn(input: { email: string; password: string }): Promise<void>;
  signOut(): Promise<void>;
  /**
   * Grava o negócio no meio do onboarding, sem encerrá-lo.
   *
   * O onboarding do item D-02 salva progresso a cada etapa, e o negócio é a
   * primeira coisa que fica completa. Recarregar aqui jogaria a usuária para
   * dentro do aplicativo antes do primeiro resultado, então o estado é
   * atualizado sem mexer no `status`.
   */
  saveOnboardingBusiness(input: {
    businessName: string;
    primaryCategory: string;
    /** Outros segmentos atendidos; o servidor descarta o principal repetido. */
    secondaryCategories: string[];
    workModel: string;
  }): Promise<api.Business>;
  /** Última etapa do onboarding: recarrega tudo e leva a usuária para dentro. */
  finishOnboarding(): Promise<void>;
  reload(): Promise<void>;
  updateProfile(input: { name: string }): Promise<void>;
  changePassword(input: { currentPassword: string; newPassword: string }): Promise<void>;
  deleteAccount(): Promise<void>;
  saveSettings(input: api.SettingsInput): Promise<void>;
  createService(input: api.ServiceInput): Promise<api.Service>;
  updateService(id: string, input: Partial<api.ServiceInput>): Promise<api.Service>;
  removeService(id: string): Promise<void>;
  duplicateService(id: string): Promise<api.Service>;
  archiveService(id: string, archived: boolean): Promise<api.Service>;
  /**
   * Calcula o preço de um serviço.
   *
   * Devolve junto de onde veio o custo fixo (`fixedCostBreakdown`): a tela de
   * preço precisa dizer quanto daquele custo é reserva para repor equipamentos.
   */
  priceService(
    id: string,
    options?: { save?: boolean; currentPriceCents?: number | null },
  ): Promise<{
    result: api.PricingResult;
    fixedCostBreakdown: api.FixedCostBreakdown;
    saved: api.Calculation | null;
  }>;
  saveQuickCalculation(input: api.PublicPricingInput): Promise<api.Calculation>;
  createMaterial(input: api.MaterialInput): Promise<api.Material>;
  updateMaterial(id: string, input: Partial<api.MaterialInput>): Promise<api.Material>;
  removeMaterial(id: string): Promise<void>;
  archiveMaterial(id: string, archived: boolean): Promise<api.Material>;
  /**
   * Pede o cancelamento da assinatura.
   *
   * Só o canal web é cancelável por aqui; Google Play e App Store não permitem
   * que o aplicativo cancele por conta própria, e o servidor recusa com `409`.
   */
  /**
   * Guarda o link da agenda pública que acabou de ser ligado, trocado ou
   * desligado.
   *
   * O negócio em memória precisa acompanhar, senão o Perfil continua dizendo
   * "agenda fechada" depois de ela ligar na outra tela — e ela não tem como
   * saber qual das duas telas está certa.
   */
  setBookingToken(bookingSlug: string | null): void;
  cancelSubscription(subscriptionId: string): Promise<void>;
  dismissMigration(): void;
  showAgendaDay(day: Date): Promise<void>;
  createAppointment(input: api.AppointmentInput): Promise<api.Appointment>;
  updateAppointment(id: string, input: Partial<api.AppointmentInput>): Promise<api.Appointment>;
  settleAppointment(id: string, paidCents?: number): Promise<api.Appointment>;
  removeAppointment(id: string): Promise<void>;
  createFixedCost(input: api.FixedCostInput): Promise<api.FixedCost>;
  updateFixedCost(id: string, input: Partial<api.FixedCostInput>): Promise<api.FixedCost>;
  removeFixedCost(id: string): Promise<void>;
};

const AppContext = createContext<(State & Actions & { token: string | null }) | null>(null);

export function AppProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<State>(empty);
  const [token, setToken] = useState<string | null>(null);
  // O dia visível muda fora do ciclo das ações; a referência evita capturar um
  // valor velho dentro dos callbacks memorizados.
  const stateRef = useRef(state);
  stateRef.current = state;

  /**
   * Plano visto na leitura anterior.
   *
   * A assinatura é concluída e cancelada fora do aplicativo — no navegador ou
   * na loja —, então os eventos `subscription_started` e
   * `subscription_cancelled` do item C-05 só podem ser reconhecidos aqui,
   * comparando o plano que voltou do servidor com o que valia antes.
   */
  const lastPlan = useRef<api.SubscriptionStatus['plan'] | null>(null);

  /** Espelho do tamanho da lista para as ações memorizadas, que leriam estado antigo. */
  const serviceCount = useRef(0);
  useEffect(() => {
    serviceCount.current = state.services.length;
  }, [state.services.length]);

  const patch = useCallback((values: Partial<State>) => setState((current) => ({ ...current, ...values })), []);

  /**
   * Carrega tudo o que a interface precisa de uma vez.
   *
   * Em paralelo porque nenhuma dessas leituras depende da outra, e a Home
   * mostra dados de quase todas ao mesmo tempo.
   */
  const load = useCallback(async (sessionToken: string) => {
    const [user, businesses] = await Promise.all([api.getMe(sessionToken), api.listBusinesses(sessionToken)]);
    const business = businesses[0] ?? null;

    if (!business) {
      setState({ ...empty, status: 'onboarding', user });
      return;
    }

    const scope = { token: sessionToken, businessId: business.id };
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const [
      settings,
      services,
      materials,
      fixedCosts,
      history,
      subscription,
      appointments,
      daySummary,
      monthAppointments,
    ] = await Promise.all([
      api.getSettings(sessionToken, business.id),
      api.listServices(scope),
      api.listMaterials(scope),
      api.listFixedCosts(scope),
      api.listCalculations(scope),
      api.getSubscription(scope),
      api.listAppointments(scope, { day: today }),
      api.getDaySummary(scope, today),
      api.listAppointments(scope, { from: monthStart, to: monthEnd }),
    ]);

    reportPlanChange(lastPlan, subscription.plan);

    // Só depois da configuração o negócio sabe calcular; antes disso o cálculo
    // anônimo espera no aparelho em vez de virar erro.
    const migrated = settings ? await migratePendingCalculation(scope) : null;

    setState({
      status: settings ? 'ready' : 'onboarding',
      user,
      business,
      settings,
      subscription,
      services,
      materials,
      fixedCosts,
      calculations: migrated ? [migrated, ...history.items] : history.items,
      calculationsLimitedByPlan: history.limitedByPlan,
      appointments,
      daySummary,
      monthAppointments,
      agendaDay: today,
      migratedCalculation: migrated,
      loadError: null,
    });
  }, []);

  /** Sessão guardada no aparelho: é o que faz o app abrir já dentro da conta. */
  const restore = useCallback(async () => {
    const stored = await AsyncStorage.getItem(SESSION_KEY).catch(() => null);
    if (!stored) {
      setState({ ...empty, status: 'signed-out' });
      return;
    }

    setToken(stored);
    try {
      await load(stored);
    } catch (error) {
      // Token vencido ou derrubado por troca de senha: some do aparelho e a
      // usuária volta para a entrada, sem mensagem de erro que não ajuda.
      if (error instanceof ApiError && error.isUnauthenticated) {
        await AsyncStorage.removeItem(SESSION_KEY).catch(() => undefined);
        setToken(null);
        setState({ ...empty, status: 'signed-out' });
        return;
      }
      setState({ ...empty, status: 'signed-out', loadError: message(error) });
    }
  }, [load]);

  useEffect(() => {
    void restore();
  }, [restore]);

  const startSession = useCallback(
    async (session: api.Session) => {
      await AsyncStorage.setItem(SESSION_KEY, session.token).catch(() => undefined);
      setToken(session.token);
      // Conta nova neste aparelho: o plano da conta anterior não serve de
      // comparação e viraria um `subscription_cancelled` falso.
      lastPlan.current = null;
      await load(session.token);
    },
    [load],
  );

  const requireScope = useCallback(() => {
    if (!token || !state.business) throw new ApiError('Entre na sua conta para continuar.', 401);
    return { token, businessId: state.business.id };
  }, [token, state.business]);

  /**
   * Recarrega a agenda depois de escrever.
   *
   * O resumo do dia é somado no servidor, então relê junto: manter a conta em
   * dois lugares é onde ela começa a divergir.
   */
  const refreshAgenda = useCallback(
    async (scope: { token: string; businessId: string }, day?: Date) => {
      const target = day ?? stateRef.current.agendaDay;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // O mês vem junto porque o relatório da Home sai daqui: sem isso, marcar
      // um atendimento mudava a agenda do dia e deixava o resumo do mês
      // mostrando o número antigo até o app ser reaberto.
      const [appointments, daySummary, monthAppointments] = await Promise.all([
        api.listAppointments(scope, { day: target }),
        api.getDaySummary(scope, target),
        api.listAppointments(scope, { from: monthStart, to: monthEnd }),
      ]);

      setState((current) => ({
        ...current,
        appointments,
        daySummary,
        monthAppointments,
        agendaDay: target,
      }));
    },
    [],
  );

  const actions = useMemo<Actions>(() => {
    const withToken = () => {
      if (!token) throw new ApiError('Entre na sua conta para continuar.', 401);
      return token;
    };

    return {
      async signUp(input) {
        const session = await api.signUp(input);
        track('signup_completed');
        await startSession(session);
      },
      async signIn(input) {
        await startSession(await api.signIn(input));
      },
      async signOut() {
        // A sessão sai do aparelho mesmo se o servidor não responder: manter a
        // usuária presa dentro da conta por causa de rede é pior.
        if (token) await api.signOut(token).catch(() => undefined);
        // O rascunho do onboarding é da conta que saiu, não do aparelho: em
        // celular compartilhado ele não pode aparecer para a próxima pessoa.
        await forgetDraft();
        await AsyncStorage.removeItem(SESSION_KEY).catch(() => undefined);
        setToken(null);
        setState({ ...empty, status: 'signed-out' });
      },
      async saveOnboardingBusiness(input) {
        const sessionToken = withToken();
        const name = input.businessName.trim() || null;

        // Voltar uma etapa e avançar de novo não pode criar um segundo
        // negócio: o plano gratuito só permite um, e o segundo viraria 402.
        const business = state.business
          ? await api.updateBusiness(sessionToken, state.business.id, {
            name,
            primaryCategory: input.primaryCategory,
            secondaryCategories: input.secondaryCategories,
            workModel: input.workModel,
          })
          : await api.createBusiness(sessionToken, {
            name,
            primaryCategory: input.primaryCategory,
            secondaryCategories: input.secondaryCategories,
            workModel: input.workModel,
          });

        patch({ business });
        return business;
      },
      async finishOnboarding() {
        await load(withToken());
      },
      async reload() {
        await load(withToken());
      },
      async updateProfile(input) {
        patch({ user: await api.updateMe(withToken(), input) });
      },
      async changePassword(input) {
        await api.changePassword(withToken(), input);
        // A troca derruba as sessões, inclusive esta: sair é o efeito correto.
        await AsyncStorage.removeItem(SESSION_KEY).catch(() => undefined);
        setToken(null);
        setState({ ...empty, status: 'signed-out' });
      },
      async deleteAccount() {
        await api.deleteAccount(withToken());
        await forgetDraft();
        await AsyncStorage.removeItem(SESSION_KEY).catch(() => undefined);
        setToken(null);
        setState({ ...empty, status: 'signed-out' });
      },
      async saveSettings(input) {
        const scope = requireScope();
        patch({ settings: await api.saveSettings(scope.token, scope.businessId, input) });
      },
      async createService(input) {
        const service = await api.createService(requireScope(), input);
        // O primeiro serviço salvo é o marco do funil (`first_service_saved`).
        // A contagem vem do `ref` porque as ações são memorizadas e leriam uma
        // lista antiga do estado.
        if (serviceCount.current === 0) track('first_service_saved');
        setState((current) => ({ ...current, services: [...current.services, service] }));
        return service;
      },
      async updateService(id, input) {
        const service = await api.updateService(requireScope(), id, input);
        setState((current) => ({ ...current, services: current.services.map((item) => (item.id === id ? service : item)) }));
        return service;
      },
      async removeService(id) {
        await api.deleteService(requireScope(), id);
        setState((current) => ({ ...current, services: current.services.filter((item) => item.id !== id) }));
      },
      async duplicateService(id) {
        const copy = await api.duplicateService(requireScope(), id);
        setState((current) => ({ ...current, services: [...current.services, copy] }));
        return copy;
      },
      async archiveService(id, archived) {
        const scope = requireScope();
        const service = archived ? await api.archiveService(scope, id) : await api.restoreService(scope, id);
        setState((current) => ({
          ...current,
          services: current.services.map((item) => (item.id === id ? service : item)),
        }));
        return service;
      },
      async priceService(id, options = {}) {
        const priced = await api.priceService(requireScope(), id, options);
        if (priced.saved) {
          const saved = priced.saved;
          setState((current) => ({ ...current, calculations: [saved, ...current.calculations] }));
        }
        return {
          result: priced.result,
          fixedCostBreakdown: priced.fixedCostBreakdown,
          saved: priced.saved,
        };
      },
      async saveQuickCalculation(input) {
        const { saved } = await api.saveCalculation(requireScope(), input);
        setState((current) => ({ ...current, calculations: [saved, ...current.calculations] }));
        return saved;
      },
      async createMaterial(input) {
        const material = await api.createMaterial(requireScope(), input);
        setState((current) => ({ ...current, materials: [...current.materials, material] }));
        return material;
      },
      async updateMaterial(id, input) {
        const material = await api.updateMaterial(requireScope(), id, input);
        setState((current) => ({ ...current, materials: current.materials.map((item) => (item.id === id ? material : item)) }));
        return material;
      },
      async removeMaterial(id) {
        await api.deleteMaterial(requireScope(), id);
        setState((current) => ({ ...current, materials: current.materials.filter((item) => item.id !== id) }));
      },
      async archiveMaterial(id, archived) {
        const scope = requireScope();
        const material = archived ? await api.archiveMaterial(scope, id) : await api.restoreMaterial(scope, id);
        setState((current) => ({
          ...current,
          materials: current.materials.map((item) => (item.id === id ? material : item)),
        }));
        return material;
      },
      dismissMigration() {
        setState((current) => ({ ...current, migratedCalculation: null }));
      },
      setBookingToken(bookingSlug) {
        setState((current) =>
          current.business ? { ...current, business: { ...current.business, bookingSlug } } : current,
        );
      },
      /**
       * Pede o cancelamento e relê a assinatura.
       *
       * O plano não muda na hora, e isso é correto: o pedido vai ao
       * processador, e `subscriptions` só reflete quando o webhook confirmar.
       * Mostrar "cancelado" antes disso seria o aplicativo afirmando algo que a
       * cobrança ainda não sabe.
       */
      async cancelSubscription(subscriptionId) {
        const scope = requireScope();
        await api.cancelSubscription(scope, subscriptionId);

        const subscription = await api.getSubscription(scope);
        setState((current) => ({ ...current, subscription }));
      },
      /**
       * Troca o dia da agenda e traz atendimentos e resumo desse dia.
       *
       * Não recarrega o mês: navegar entre dias não muda o que aconteceu no
       * mês, e buscar de novo a cada toque na tira da semana seria uma
       * requisição por toque, sem nada de novo para mostrar.
       */
      async showAgendaDay(day) {
        const scope = requireScope();
        const [appointments, daySummary] = await Promise.all([
          api.listAppointments(scope, { day }),
          api.getDaySummary(scope, day),
        ]);
        setState((current) => ({ ...current, appointments, daySummary, agendaDay: day }));
      },
      async createAppointment(input) {
        const scope = requireScope();
        const appointment = await api.createAppointment(scope, input);
        await refreshAgenda(scope, new Date(input.startsAt));
        return appointment;
      },
      async updateAppointment(id, input) {
        const scope = requireScope();
        const appointment = await api.updateAppointment(scope, id, input);
        await refreshAgenda(scope);
        return appointment;
      },
      async settleAppointment(id, paidCents) {
        const scope = requireScope();
        const appointment = await api.settleAppointment(scope, id, paidCents);
        await refreshAgenda(scope);
        return appointment;
      },
      async removeAppointment(id) {
        const scope = requireScope();
        await api.deleteAppointment(scope, id);
        await refreshAgenda(scope);
      },
      async createFixedCost(input) {
        const cost = await api.createFixedCost(requireScope(), input);
        setState((current) => ({ ...current, fixedCosts: [...current.fixedCosts, cost] }));
        return cost;
      },
      async updateFixedCost(id, input) {
        const cost = await api.updateFixedCost(requireScope(), id, input);
        setState((current) => ({ ...current, fixedCosts: current.fixedCosts.map((item) => (item.id === id ? cost : item)) }));
        return cost;
      },
      async removeFixedCost(id) {
        await api.deleteFixedCost(requireScope(), id);
        setState((current) => ({ ...current, fixedCosts: current.fixedCosts.filter((item) => item.id !== id) }));
      },
    };
  }, [token, state.business, startSession, load, patch, requireScope, refreshAgenda]);

  const value = useMemo(() => ({ ...state, token, ...actions }), [state, token, actions]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp precisa estar dentro de AppProvider.');
  return value;
}

/**
 * Leva o cálculo feito sem cadastro para o histórico da conta (`D-03`).
 *
 * Falhar aqui não pode atrapalhar a entrada: no pior caso a usuária apenas não
 * vê o cálculo antigo, e a cópia local segue guardada para a próxima tentativa.
 */
async function migratePendingCalculation(
  scope: { token: string; businessId: string },
): Promise<api.Calculation | null> {
  const pending = await readCalculation();
  if (!pending) return null;

  try {
    const { saved } = await api.saveCalculation(scope, pending.input);
    await forgetCalculation();
    return saved;
  } catch {
    return null;
  }
}

/**
 * Traduz a mudança de plano em evento do funil (item C-05).
 *
 * Só o nome do plano viaja — nunca o preço, que é justamente o que o critério
 * de aceite proíbe. A primeira leitura da sessão não emite nada: ela não é uma
 * mudança, é o estado em que a usuária já estava.
 */
function reportPlanChange(
  last: { current: api.SubscriptionStatus['plan'] | null },
  plan: api.SubscriptionStatus['plan'],
): void {
  const previous = last.current;
  last.current = plan;
  if (previous === null || previous === plan) return;
  track(plan === 'FREE' ? 'subscription_cancelled' : 'subscription_started', { plan });
}

/** Mensagem exibível de qualquer falha: a da API quando existe, genérica quando não. */
export function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Não conseguimos concluir agora. Tente novamente em instantes.';
}
