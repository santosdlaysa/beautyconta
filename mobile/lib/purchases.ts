import { Platform } from 'react-native';
import type { PaymentMethod } from './resources';

/**
 * Compra dentro do aplicativo, pelas lojas, via RevenueCat.
 *
 * Existe porque Apple e Google **exigem** que conteúdo digital vendido dentro do
 * aplicativo seja comprado pelo sistema de pagamento delas. Mandar a assinante
 * para o Mercado Pago dentro do aplicativo de loja é motivo de recusa na
 * submissão — por isso o Pix e o cartão do Mercado Pago só aparecem na web.
 *
 * Quem concede o plano continua sendo o servidor, pelo webhook do RevenueCat: o
 * aplicativo compra e informa, nunca decide. É a regra da seção 3 do documento
 * 11, e é o que impede que um aparelho comprometido se conceda o plano pago.
 */

/** Um plano à venda na loja, com o preço que ela mesma informa. */
export type StoreOffering = {
  /** Identificador do pacote, para pedir a compra depois. */
  id: string;
  productId: string;
  /**
   * Preço já formatado pela loja, na moeda do país da conta.
   *
   * Vem pronto de propósito: o valor varia por país, e formatar por conta
   * própria mostraria um número diferente do que será cobrado.
   */
  priceLabel: string;
  billingPeriod: 'MONTHLY' | 'ANNUAL' | 'UNKNOWN';
};

export type PurchaseOutcome =
  | { status: 'purchased' }
  /** A pessoa desistiu. Não é erro, e não merece mensagem de erro. */
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

/**
 * As chaves públicas do RevenueCat.
 *
 * São chaves de cliente, feitas para viajar no aplicativo — não confundir com a
 * chave secreta, que fica no servidor. `EXPO_PUBLIC_` é o que faz o Expo
 * embutir o valor no pacote publicado.
 */
const API_KEYS: Record<string, string | undefined> = {
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
};

/**
 * Qual forma de pagamento a plataforma permite.
 *
 * Função pura, e por isso testável: é ela que impede o erro caro — oferecer Pix
 * dentro do aplicativo de loja e ter a submissão recusada.
 */
export function allowedPaymentMethods(os: string): PaymentMethod[] | 'store' {
  return os === 'ios' || os === 'android' ? 'store' : ['card', 'pix'];
}

/** Se a compra pela loja pode sequer ser tentada nesta plataforma. */
export function storePurchaseAvailable(): boolean {
  return allowedPaymentMethods(Platform.OS) === 'store' && Boolean(API_KEYS[Platform.OS]);
}

/**
 * Período do plano a partir do identificador do produto.
 *
 * O RevenueCat expõe o período em campos que mudaram de nome entre versões; o
 * identificador do produto é combinado por nós no painel e não muda sozinho.
 */
export function periodFromProductId(productId: string): StoreOffering['billingPeriod'] {
  const id = productId.toLowerCase();
  if (id.includes('annual') || id.includes('yearly') || id.includes('anual')) return 'ANNUAL';
  if (id.includes('month') || id.includes('mensal')) return 'MONTHLY';
  return 'UNKNOWN';
}

/**
 * O SDK, carregado só quando existe.
 *
 * Em Expo Go não há módulo nativo, e um `import` no topo derrubaria o aplicativo
 * inteiro na abertura — inclusive para quem nunca vai abrir a tela de planos.
 */
type PurchasesModule = typeof import('react-native-purchases').default;

let modulo: PurchasesModule | null = null;
let configurado = false;

function carregar(): PurchasesModule | null {
  if (modulo) return modulo;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const carregado = require('react-native-purchases') as { default: PurchasesModule };
    modulo = carregado.default;
    return modulo;
  } catch {
    // Sem módulo nativo: a tela cai para o caminho da web, e nada quebra.
    return null;
  }
}

/**
 * Prepara o SDK e diz a ele quem está comprando.
 *
 * O identificador é o **do negócio**, e nunca o e-mail: é ele que o webhook usa
 * para saber a quem conceder o plano, e é o que o documento de dados pessoais
 * manda enviar a terceiros. Mandar e-mail aqui vazaria dado pessoal para o
 * RevenueCat sem necessidade nenhuma.
 */
export async function configurePurchases(businessId: string): Promise<boolean> {
  const sdk = carregar();
  const apiKey = API_KEYS[Platform.OS];
  if (!sdk || !apiKey) return false;

  try {
    if (!configurado) {
      await sdk.configure({ apiKey, appUserID: businessId });
      configurado = true;
    } else {
      // Trocar de conta no mesmo aparelho: sem isto, a compra iria para o
      // negócio de quem entrou antes.
      await sdk.logIn(businessId);
    }
    return true;
  } catch {
    return false;
  }
}

/** O que a loja tem à venda, com o preço dela. */
export async function getStoreOfferings(): Promise<StoreOffering[]> {
  const sdk = carregar();
  if (!sdk) return [];

  try {
    const offerings = await sdk.getOfferings();
    const pacotes = offerings.current?.availablePackages ?? [];

    return pacotes.map((pacote) => ({
      id: pacote.identifier,
      productId: pacote.product.identifier,
      priceLabel: pacote.product.priceString,
      billingPeriod: periodFromProductId(pacote.product.identifier),
    }));
  } catch {
    return [];
  }
}

/**
 * Compra um pacote.
 *
 * O plano **não** é concedido aqui. A loja confirma, o RevenueCat avisa o nosso
 * servidor pelo webhook, e o servidor decide — que é o único jeito de o acesso
 * não depender do que um aparelho afirma sobre si mesmo.
 */
export async function purchasePackage(packageId: string): Promise<PurchaseOutcome> {
  const sdk = carregar();
  if (!sdk) return { status: 'error', message: 'A compra não está disponível neste aparelho.' };

  try {
    const offerings = await sdk.getOfferings();
    const pacote = offerings.current?.availablePackages.find((item) => item.identifier === packageId);

    if (!pacote) return { status: 'error', message: 'Este plano não está mais disponível.' };

    await sdk.purchasePackage(pacote);
    return { status: 'purchased' };
  } catch (erro: unknown) {
    return interpretarErro(erro);
  }
}

/**
 * Restaura compras anteriores.
 *
 * A Apple **exige** este caminho em todo aplicativo com assinatura: quem trocou
 * de aparelho ou reinstalou precisa recuperar o que já pagou sem pagar de novo.
 * Sem ele, a submissão é recusada.
 */
export async function restorePurchases(): Promise<PurchaseOutcome> {
  const sdk = carregar();
  if (!sdk) return { status: 'error', message: 'A restauração não está disponível neste aparelho.' };

  try {
    await sdk.restorePurchases();
    return { status: 'purchased' };
  } catch (erro: unknown) {
    return interpretarErro(erro);
  }
}

/**
 * Desistência não é falha.
 *
 * O SDK marca o cancelamento com `userCancelled`. Tratar isso como erro encheria
 * a tela de vermelho para quem só mudou de ideia.
 */
export function interpretarErro(erro: unknown): PurchaseOutcome {
  const detalhe = erro as { userCancelled?: boolean; message?: string } | null;

  if (detalhe?.userCancelled) return { status: 'cancelled' };

  return {
    status: 'error',
    message: detalhe?.message ?? 'Não foi possível concluir a compra. Tente de novo.',
  };
}
