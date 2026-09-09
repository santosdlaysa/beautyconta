import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Progresso do onboarding de cinco etapas (item D-02).
 *
 * O critério de aceite pede progresso salvo a cada etapa, mas a API não tem
 * rota de rascunho: `POST /businesses` e `PUT /businesses/:id/settings` só
 * aceitam cadastros completos. A saída é a mesma do cálculo anônimo em
 * `anonymous.ts` — o que já é enviável sobe ao servidor no fim da etapa em que
 * fica completo, e o resto espera no aparelho. Quem fecha o aplicativo na
 * etapa 3 volta na etapa 3, com o que já digitou.
 *
 * Uma parte do que o documento 02 pede não tem campo na API: as outras
 * categorias atendidas e a meta de lucro mensal. Elas ficam aqui, no aparelho,
 * até existir lugar para elas no servidor — a meta ainda serve de valor inicial
 * do simulador do item A-04.
 */

const DRAFT_KEY = 'beautyconta.onboarding.rascunho';
const GOAL_KEY = 'beautyconta.meta.lucro.centavos';

/** Etapas da seção 3 do documento 02, na ordem em que aparecem. */
export const STEPS = ['atuacao', 'trabalho', 'capacidade', 'objetivo', 'resultado'] as const;
export type Step = (typeof STEPS)[number];

export type OnboardingDraft = {
  step: Step;
  /** Etapas que a usuária pulou: o resumo final diz onde completá-las depois. */
  skipped: Step[];
  primaryCategory: string;
  /** Sem campo na API; guardado para quando houver. */
  otherCategories: string[];
  businessName: string;
  workModel: string;
  daysPerMonth: string;
  hoursPerDay: string;
  appointmentsPerMonth: string;
  withdrawal: string;
  profitGoal: string;
  /** Como a usuária prefere definir a hora: dizendo o valor ou deixando calcular. */
  hourlyMode: 'calcular' | 'informar';
  hourlyRate: string;
};

/**
 * Ponto de partida.
 *
 * Os números não são zero de propósito: uma usuária que pula tudo precisa sair
 * do onboarding com uma configuração que calcula, e estes são os mesmos valores
 * que a tela única anterior já sugeria.
 */
export const emptyDraft: OnboardingDraft = {
  step: 'atuacao',
  skipped: [],
  primaryCategory: 'nails',
  otherCategories: [],
  businessName: '',
  workModel: 'home',
  daysPerMonth: '20',
  hoursPerDay: '6',
  appointmentsPerMonth: '60',
  withdrawal: '3.000,00',
  profitGoal: '',
  hourlyMode: 'calcular',
  hourlyRate: '',
};

export async function saveDraft(draft: OnboardingDraft): Promise<void> {
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft)).catch(() => undefined);
}

export async function readDraft(): Promise<OnboardingDraft | null> {
  const stored = await AsyncStorage.getItem(DRAFT_KEY).catch(() => null);
  if (!stored) return null;
  try {
    // Mesclado com o padrão: rascunho de uma versão anterior do app não pode
    // deixar um campo indefinido no formulário.
    return { ...emptyDraft, ...(JSON.parse(stored) as Partial<OnboardingDraft>) };
  } catch {
    return null;
  }
}

export async function forgetDraft(): Promise<void> {
  await AsyncStorage.removeItem(DRAFT_KEY).catch(() => undefined);
}

/** Meta de lucro mensal em centavos inteiros, como todo dinheiro do produto. */
export async function saveMonthlyProfitGoal(cents: number): Promise<void> {
  if (cents <= 0) {
    await AsyncStorage.removeItem(GOAL_KEY).catch(() => undefined);
    return;
  }
  await AsyncStorage.setItem(GOAL_KEY, String(Math.round(cents))).catch(() => undefined);
}

export async function readMonthlyProfitGoal(): Promise<number | null> {
  const stored = await AsyncStorage.getItem(GOAL_KEY).catch(() => null);
  const cents = stored === null ? Number.NaN : Number(stored);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}
