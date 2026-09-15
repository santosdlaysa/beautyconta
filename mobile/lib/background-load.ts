/** Cada consulta publica seu resultado sem esperar pelas outras. */
export async function backgroundLoad<K extends string, V>(
  tasks: Partial<Record<K, () => Promise<V>>>,
  current: () => boolean,
  success: (key: K, value: V) => void,
  failure: (key: K, error: unknown) => void,
  timeoutMs = 30_000,
): Promise<void> {
  await Promise.all((Object.entries(tasks) as [K, () => Promise<V>][]).map(async ([key, task]) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const value = await Promise.race([
        task(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('A atualização demorou mais que o esperado. Tente novamente.')), timeoutMs);
        }),
      ]);
      if (current()) success(key, value);
    } catch (error) {
      if (current()) failure(key, error);
    } finally {
      clearTimeout(timer);
    }
  }));
}

export type DataGroup = 'services' | 'materials' | 'costs' | 'history' | 'subscription' | 'agenda' | 'month';
export type DataState = Record<DataGroup, 'loading' | 'ready' | 'error'>;
export const pendingData: DataState = {
  services: 'loading', materials: 'loading', costs: 'loading', history: 'loading',
  subscription: 'loading', agenda: 'loading', month: 'loading',
};

const dependencies: Record<string, DataGroup[]> = {
  calcular: ['services', 'materials', 'costs', 'history', 'subscription'],
  servicos: ['services', 'materials', 'costs', 'subscription'],
  custos: ['costs', 'materials', 'subscription'],
  planos: ['subscription', 'services', 'materials', 'costs', 'history'],
  clientes: ['agenda'], agenda: ['agenda', 'month', 'services', 'subscription'],
  'agenda-online': ['subscription', 'services'], expediente: ['subscription'],
  financeiro: ['services', 'costs', 'history', 'agenda', 'month'], estoque: ['materials', 'subscription'],
  equipamentos: ['subscription'], relatorios: ['services', 'costs', 'history', 'month', 'subscription'],
  perfil: ['subscription'],
};

export function screenDataState(tab: string, data: DataState): 'ready' | 'loading' | 'error' {
  const states = (dependencies[tab] ?? []).map(key => data[key]);
  return states.includes('error') ? 'error' : states.includes('loading') ? 'loading' : 'ready';
}
