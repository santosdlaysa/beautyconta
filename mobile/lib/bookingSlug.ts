import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * O link da agenda pública guardado neste aparelho.
 *
 * Existe por uma lacuna do servidor: há rota para ligar, trocar e desligar o
 * link, mas **nenhuma para perguntar qual é**, e o negócio não devolve o token
 * na leitura. Sem esta cópia, a tela só saberia o endereço no instante em que o
 * criasse — e a profissional perderia o link ao fechar o aplicativo.
 *
 * Cópia não é verdade: quem manda continua sendo o servidor. Antes de mostrar,
 * a tela confere o token guardado contra a página pública, e o descarta quando
 * ele não abre mais.
 */

const key = (businessId: string) => `beautyconta.agenda-publica.${businessId}`;

export async function rememberBookingToken(businessId: string, bookingSlug: string): Promise<void> {
  await AsyncStorage.setItem(key(businessId), bookingSlug).catch(() => undefined);
}

export async function readBookingToken(businessId: string): Promise<string | null> {
  return AsyncStorage.getItem(key(businessId)).catch(() => null);
}

export async function forgetBookingToken(businessId: string): Promise<void> {
  await AsyncStorage.removeItem(key(businessId)).catch(() => undefined);
}
