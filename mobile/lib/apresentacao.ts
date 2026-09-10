/**
 * Apresentação: as telas que a pessoa vê na primeira vez que abre o aplicativo,
 * antes da tela de boas-vindas.
 *
 * **Vocabulário — isto não é o onboarding.** O aplicativo tem três coisas
 * parecidas e é fácil confundi-las no código:
 *
 * - **apresentação** (este arquivo): antes de existir conta, diz o que o
 *   BeautyConta faz. Roda uma vez por aparelho.
 * - **onboarding** (`lib/onboarding.ts`, `components/OnboardingScreens.tsx`):
 *   as cinco etapas que configuram o negócio depois do cadastro.
 * - **primeiros passos** (`lib/primeirosPassos.ts`): o tutorial que aparece na
 *   Home depois de a configuração terminar.
 *
 * O que a apresentação promete é só o que o produto entrega hoje: preço com
 * custo real, margem, agenda e link de agendamento. Clientes e financeiro ainda
 * são telas de demonstração declarada, e a "Regra de comunicação dos planos" da
 * seção 6 do documento 01 proíbe vendê-los como disponíveis.
 *
 * Este arquivo não importa nada do React Native de propósito, pela mesma razão
 * de `analytics.ts`: assim o teste roda em Node puro.
 */

/** Ícones que a apresentação usa; são nomes de `IconName` em `AppChrome.tsx`. */
export type IconeDaApresentacao = 'calculator' | 'trend' | 'calendar';

export type SlideDaApresentacao = {
  id: string;
  icone: IconeDaApresentacao;
  /** Tom do `IconBubble`, para as telas não saírem todas na mesma cor. */
  tom: 'pink' | 'lilac';
  titulo: string;
  texto: string;
};

/**
 * Três telas, nesta ordem.
 *
 * A primeira é a promessa do produto — "saiba quanto cobrar sem trabalhar no
 * prejuízo" —, a segunda é o que ela vê depois do cálculo e a terceira é o que
 * o aplicativo faz além de calcular. Quatro seriam uma a mais entre a pessoa e
 * a calculadora, que é o principal mecanismo de aquisição (seção 7 do
 * documento 05).
 */
export const SLIDES_DA_APRESENTACAO: readonly SlideDaApresentacao[] = [
  {
    id: 'custo-real',
    icone: 'calculator',
    tom: 'pink',
    titulo: 'Seu preço com o custo de verdade',
    texto:
      'Materiais, tempo de atendimento e custos fixos entram na conta. Você recebe o preço mínimo e o preço recomendado, com a composição aberta — dá para conferir de onde saiu cada valor.',
  },
  {
    id: 'quanto-sobra',
    icone: 'trend',
    tom: 'lilac',
    titulo: 'Quanto sobra em cada atendimento',
    texto:
      'O aplicativo mostra o custo por atendimento, o que sobra e a margem. Se o preço que você cobra hoje estiver abaixo do custo, ele avisa — sem lição de moral.',
  },
  {
    id: 'agenda-e-link',
    icone: 'calendar',
    tom: 'pink',
    titulo: 'A agenda do dia e o link da cliente',
    texto:
      'Anote os atendimentos, veja o que já entrou e abra um link de agendamento para suas clientes escolherem sozinhas um horário que você deixou livre.',
  },
] as const;

/**
 * Página em que a rolagem parou.
 *
 * Existe como função para o caso que quebra a conta ingênua: antes de o
 * `onLayout` medir a tela, a largura é zero, e `offset / 0` vira `NaN` — um
 * `NaN` no índice apagaria o slide e o ponto ativo ao mesmo tempo.
 */
export function indiceDaRolagem(deslocamentoX: number, largura: number, total: number): number {
  if (largura <= 0 || total <= 0) return 0;
  const pagina = Math.round(deslocamentoX / largura);
  // `pagina <= 0`, e não `< 0`: puxar a primeira tela para trás dá `-0`, que
  // passa por qualquer comparação com zero e sujaria o índice.
  if (!Number.isFinite(pagina) || pagina <= 0) return 0;
  return Math.min(pagina, total - 1);
}

/** O que a abertura do aplicativo mostra enquanto não há sessão. */
export type TelaDeAbertura = 'aguardando' | 'apresentacao' | 'entrada';

/**
 * Regra da primeira abertura.
 *
 * `apresentacaoVista` é `null` enquanto a leitura do aparelho não voltou: nesse
 * intervalo nada é decidido, senão a tela de entrada apareceria por um instante
 * e a apresentação entraria por cima dela.
 *
 * Ter conta neste aparelho encerra a apresentação mesmo que a marca não exista
 * — é o caso de quem já usava o aplicativo antes de esta tela existir. Sair da
 * conta não a traz de volta.
 */
export function telaDeAbertura(input: {
  apresentacaoVista: boolean | null;
  autenticada: boolean;
}): TelaDeAbertura {
  if (input.autenticada) return 'entrada';
  if (input.apresentacaoVista === null) return 'aguardando';
  return input.apresentacaoVista ? 'entrada' : 'apresentacao';
}
