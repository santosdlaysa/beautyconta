import { describe, expect, it } from 'vitest';
import { storePackages } from './store-packages';

const premium = { identifier: '$rc_monthly', product: { identifier: 'beautyconta_premium_monthly' } };
const master = { identifier: '$rc_monthly', product: { identifier: 'beautyconta_master_monthly' } };
const all = {
  default: { identifier: 'default', availablePackages: [premium] },
  master: { identifier: 'master', availablePackages: [master] },
};

describe('seleção de pacotes Premium e Master', () => {
  it('mostra ambos sem duplicar a oferta atual e compra o Master mesmo com IDs de pacote iguais', () => {
    const displayed = storePackages({ current: all.default, all });
    expect(displayed.map(item => item.package.product.identifier)).toEqual([
      'beautyconta_premium_monthly', 'beautyconta_master_monthly',
    ]);
    expect(displayed[0].id).not.toBe(displayed[1].id);
    const refreshed = storePackages({ current: all.master, all });
    expect(refreshed.find(item => item.id === displayed[1].id)?.package).toBe(master);
  });

  it('carrega os planos conhecidos mesmo sem oferta atual', () => {
    expect(storePackages({ current: null, all })).toHaveLength(2);
    expect(storePackages({ current: null, all: {} })).toEqual([]);
  });

  it('não troca silenciosamente o produto de um pacote selecionado', () => {
    const selected = storePackages({ current: all.master, all })[0];
    const changed = { ...all, master: { ...all.master, availablePackages: [premium] } };
    expect(storePackages({ current: null, all: changed }).find(item => item.id === selected.id)).toBeUndefined();
  });
});
