import type { PaymentMethod } from './resources';

/**
 * A outra metade de `purchases.ts` — no navegador.
 *
 * Aqui não existe loja, e é justamente por isso que a web é onde o Mercado Pago
 * vive: cartão com renovação automática e Pix avulso, sem a comissão da loja e
 * sem a proibição dela.
 *
 * O arquivo existe para que o empacotador não tente carregar o módulo nativo do
 * RevenueCat na web, onde ele não roda.
 */

export type StoreOffering = {
  id: string;
  productId: string;
  priceLabel: string;
  billingPeriod: 'MONTHLY' | 'ANNUAL' | 'UNKNOWN';
};

export type PurchaseOutcome =
  | { status: 'purchased' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export function allowedPaymentMethods(os: string): PaymentMethod[] | 'store' {
  return os === 'ios' || os === 'android' ? 'store' : ['card', 'pix'];
}

export function storePurchaseAvailable(): boolean {
  return false;
}

export function periodFromProductId(productId: string): StoreOffering['billingPeriod'] {
  const id = productId.toLowerCase();
  if (id.includes('annual') || id.includes('yearly') || id.includes('anual')) return 'ANNUAL';
  if (id.includes('month') || id.includes('mensal')) return 'MONTHLY';
  return 'UNKNOWN';
}

export function configurePurchases(_businessId: string): Promise<boolean> {
  void _businessId;
  return Promise.resolve(false);
}

export function getStoreOfferings(): Promise<StoreOffering[]> {
  return Promise.resolve([]);
}

export function purchasePackage(_packageId: string): Promise<PurchaseOutcome> {
  void _packageId;
  return Promise.resolve({ status: 'error', message: 'A compra pela loja não existe no navegador.' });
}

export function restorePurchases(): Promise<PurchaseOutcome> {
  return Promise.resolve({ status: 'error', message: 'Não há compras de loja a restaurar aqui.' });
}

export function interpretarErro(erro: unknown): PurchaseOutcome {
  const detalhe = erro as { userCancelled?: boolean; message?: string } | null;
  if (detalhe?.userCancelled) return { status: 'cancelled' };
  return { status: 'error', message: detalhe?.message ?? 'Não foi possível concluir a compra.' };
}
