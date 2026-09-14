import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

describe('canal de compra no iOS sem chave RevenueCat', () => {
  it('mantém a loja como único canal mesmo sem configuração', async () => {
    vi.stubEnv('EXPO_PUBLIC_REVENUECAT_IOS_KEY', '');
    try {
      const { storePurchaseAvailable } = await import('./purchases');
      expect(storePurchaseAvailable()).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
