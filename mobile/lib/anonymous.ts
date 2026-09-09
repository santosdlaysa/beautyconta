import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PublicPricingInput } from './resources';

/**
 * Cálculo feito antes do cadastro (item D-03).
 *
 * Fica só no aparelho enquanto não há conta, como pede a jornada pública do
 * documento 02: nada é associado a uma identidade sem consentimento. Quando a
 * usuária termina o cadastro, o provedor grava esse cálculo no histórico dela e
 * apaga a cópia local — assim o primeiro resultado não se perde nem precisa ser
 * redigitado.
 */

const KEY = 'beautyconta.calculo.anonimo';

export type PendingCalculation = { input: PublicPricingInput; serviceName: string };

export async function rememberCalculation(pending: PendingCalculation): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(pending)).catch(() => undefined);
}

export async function readCalculation(): Promise<PendingCalculation | null> {
  const stored = await AsyncStorage.getItem(KEY).catch(() => null);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as PendingCalculation;
  } catch {
    // Conteúdo corrompido não vale um erro na cara da usuária: é só descartar.
    return null;
  }
}

export async function forgetCalculation(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}
