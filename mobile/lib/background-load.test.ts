import { describe, expect, it, vi } from 'vitest';
import { backgroundLoad, pendingData, screenDataState, type DataState } from './background-load';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('consultas em segundo plano', () => {
  it('exibe o resultado rápido sem aguardar a consulta lenta', async () => {
    const slow = deferred<string>();
    const success = vi.fn();
    const failure = vi.fn();
    const done = backgroundLoad({ services: async () => 'serviços', history: () => slow.promise }, () => true, success, failure);
    await vi.waitFor(() => expect(success).toHaveBeenCalledWith('services', 'serviços'));
    expect(success).not.toHaveBeenCalledWith('history', expect.anything());
    slow.resolve('histórico');
    await done;
    expect(success).toHaveBeenCalledWith('history', 'histórico');
    expect(failure).not.toHaveBeenCalled();
  });

  it('mantém dados disponíveis quando uma consulta falha', async () => {
    const success = vi.fn();
    const failure = vi.fn();
    await backgroundLoad({ services: async () => 3, history: async () => { throw new Error('offline'); } }, () => true, success, failure);
    expect(success).toHaveBeenCalledWith('services', 3);
    expect(failure).toHaveBeenCalledWith('history', expect.any(Error));
  });

  it('ignora sucesso e erro da sessão encerrada ou substituída', async () => {
    let current = true;
    const old = deferred<number>();
    const failed = deferred<number>();
    const success = vi.fn();
    const failure = vi.fn();
    const done = backgroundLoad({ services: () => old.promise, history: () => failed.promise }, () => current, success, failure);
    current = false;
    old.resolve(9);
    failed.reject(new Error('401'));
    await done;
    expect(success).not.toHaveBeenCalled();
    expect(failure).not.toHaveBeenCalled();
  });

  it('permite tentar novamente após timeout sem aplicar resposta atrasada', async () => {
    vi.useFakeTimers();
    try {
      const slow = deferred<number>();
      const success = vi.fn();
      const failure = vi.fn();
      const done = backgroundLoad({ services: () => slow.promise }, () => true, success, failure, 1000);
      await vi.advanceTimersByTimeAsync(1000);
      await done;
      expect(failure).toHaveBeenCalledWith('services', expect.any(Error));
      slow.resolve(1);
      await Promise.resolve();
      expect(success).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
});

describe('disponibilidade das telas', () => {
  it('abre o início enquanto os dados carregam e segura cálculos e compras', () => {
    expect(screenDataState('inicio', pendingData)).toBe('ready');
    expect(screenDataState('calcular', pendingData)).toBe('loading');
    expect(screenDataState('planos', pendingData)).toBe('loading');
  });
  it('libera perfil sem esperar o histórico e mostra falha somente nas telas dependentes', () => {
    const data: DataState = { ...pendingData, subscription: 'ready', history: 'error' };
    expect(screenDataState('perfil', data)).toBe('ready');
    expect(screenDataState('planos', data)).toBe('error');
    expect(screenDataState('calcular', data)).toBe('error');
    expect(screenDataState('inicio', data)).toBe('ready');
  });
});
