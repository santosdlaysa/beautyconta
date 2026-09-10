/**
 * Primeiros passos: o tutorial que aparece na Home depois de a conta existir e
 * a configuração do negócio ter terminado — quando o aplicativo fica pronto
 * para uso.
 *
 * **Vocabulário — isto não é o onboarding e não é a apresentação.** O
 * onboarding (`lib/onboarding.ts`) são as cinco etapas que configuram o
 * negócio; a apresentação (`lib/apresentacao.ts`) são as telas da primeira
 * abertura, antes de existir conta. Os primeiros passos vêm depois dos dois.
 *
 * **Por que uma lista na Home e não um carrossel.** Quem acabou de passar por
 * cinco etapas de configuração não precisa de mais três telas antes de usar o
 * aplicativo, e um carrossel é esquecido antes de a pessoa precisar do que ele
 * ensinou. A lista fica onde a ação acontece, lê o estado real da conta — se um
 * passo já foi cumprido no onboarding, ele já nasce marcado — e desaparece
 * sozinha quando o essencial estiver pronto. Ela também não bloqueia nada: é um
 * cartão dentro da Home, que rola junto com o resto e tem um botão de fechar.
 *
 * Este arquivo é só a regra: quais são os passos e quais já foram cumpridos.
 * Não importa React Native, para o teste rodar em Node puro.
 */

/** Rotas do `App.tsx` que os passos abrem. */
export type RotaDoPasso = 'calcular' | 'estoque' | 'custos' | 'agenda-online';

export type PassoId = 'primeiro-preco' | 'material' | 'custo-fixo' | 'agenda-online';

/** O que o aplicativo já sabe sobre o negócio, do estado do `AppProvider`. */
export type EstadoDoNegocio = {
  calculos: number;
  materiais: number;
  custosFixos: number;
  /** Link público de agendamento já criado. */
  temLinkDeAgenda: boolean;
};

export type Passo = {
  id: PassoId;
  titulo: string;
  /** Para que serve, dito pelo resultado — não pelo nome do recurso. */
  motivo: string;
  /** Nome da tela como ela aparece hoje no aplicativo. */
  tela: string;
  rota: RotaDoPasso;
  /** Nome de `IconName`, em `AppChrome.tsx`. */
  icone: 'calculator' | 'box' | 'wallet' | 'calendar';
  concluido: boolean;
  /**
   * Passo que não muda o preço.
   *
   * Quem atende em salão com agenda no papel pode nunca querer link público, e
   * a lista não pode ficar presa por causa disso: ela fecha com os essenciais.
   * O caminho continua na Home, na linha "Receber agendamentos por link".
   */
  opcional: boolean;
};

/**
 * Os passos, na ordem em que ensinam.
 *
 * Calcular vem primeiro de propósito, mesmo que o preço ainda saia sem custo
 * fixo: é o princípio "resultado antes do cadastro" da seção 5 do documento 01
 * aplicado a quem já tem conta. Material e custo fixo vêm logo em seguida
 * porque são o que troca o exemplo pelos números dela.
 */
export function primeirosPassos(estado: EstadoDoNegocio): Passo[] {
  return [
    {
      id: 'primeiro-preco',
      titulo: 'Calcule seu primeiro preço',
      motivo: 'Escolha um serviço que você já faz e veja o custo, o preço mínimo e o quanto sobra.',
      tela: 'Calcular preço',
      rota: 'calcular',
      icone: 'calculator',
      concluido: estado.calculos > 0,
      opcional: false,
    },
    {
      id: 'material',
      titulo: 'Cadastre um material',
      motivo: 'Esmalte, gel, cola: com o preço da embalagem, o aplicativo descobre quanto sai por atendimento.',
      tela: 'Estoque',
      rota: 'estoque',
      icone: 'box',
      concluido: estado.materiais > 0,
      opcional: false,
    },
    {
      id: 'custo-fixo',
      titulo: 'Cadastre um custo fixo',
      motivo: 'Aluguel, energia, internet. Enquanto eles ficam de fora, o preço sai menor do que deveria.',
      tela: 'Custos',
      rota: 'custos',
      icone: 'wallet',
      concluido: estado.custosFixos > 0,
      opcional: false,
    },
    {
      id: 'agenda-online',
      titulo: 'Abra sua agenda online',
      motivo: 'Um link para a cliente escolher sozinha um horário que você deixou livre.',
      tela: 'Agenda online',
      rota: 'agenda-online',
      icone: 'calendar',
      concluido: estado.temLinkDeAgenda,
      opcional: true,
    },
  ];
}

/** Os passos que seguram a lista na tela. */
export function passosEssenciais(passos: readonly Passo[]): Passo[] {
  return passos.filter((passo) => !passo.opcional);
}

export function passosConcluidos(passos: readonly Passo[]): number {
  return passos.filter((passo) => passo.concluido).length;
}

/** A lista terminou o seu trabalho: o preço já usa os números dela. */
export function guiaCumprido(estado: EstadoDoNegocio): boolean {
  return passosEssenciais(primeirosPassos(estado)).every((passo) => passo.concluido);
}
