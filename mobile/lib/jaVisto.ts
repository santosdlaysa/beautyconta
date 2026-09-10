import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * O que já foi mostrado uma vez neste aparelho.
 *
 * Dois avisos do aplicativo existem para não se repetirem: a **apresentação**
 * da primeira abertura (`lib/apresentacao.ts`) e os **primeiros passos** da
 * Home (`lib/primeirosPassos.ts`). Nenhum dos dois é dado do negócio, então
 * nenhum dos dois sobe ao servidor — ficam no aparelho, como o rascunho do
 * onboarding e o cálculo anônimo já fazem.
 *
 * A diferença importante em relação ao rascunho do onboarding: sair da conta
 * **não** apaga estas marcas. O rascunho é da conta que saiu e não pode
 * aparecer para a próxima pessoa; estas marcas são de quem segura o aparelho, e
 * quem já viu a apresentação não tem por que vê-la de novo ao trocar de conta.
 * Por isso `AppProvider.signOut` chama `forgetDraft` e não mexe aqui.
 */

export type Marco = 'apresentacao' | 'primeiros-passos';

const chave = (marco: Marco) => `beautyconta.visto.${marco}`;

/** Falha de leitura conta como "ainda não viu": mostrar de novo é melhor do que sumir. */
export async function jaViu(marco: Marco): Promise<boolean> {
  const guardado = await AsyncStorage.getItem(chave(marco)).catch(() => null);
  return guardado === 'sim';
}

export async function marcarVisto(marco: Marco): Promise<void> {
  await AsyncStorage.setItem(chave(marco), 'sim').catch(() => undefined);
}
