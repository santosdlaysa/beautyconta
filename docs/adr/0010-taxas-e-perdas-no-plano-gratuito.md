# ADR-0010 — Taxas, perdas e outros custos diretos no plano gratuito

**Estado:** Aceito
**Data:** 2026-09-09
**Responsável:** Implementação da API, sem ratificação da dona do produto

## Contexto

A documentação se contradizia em dois pontos que a API precisava atender ao
mesmo tempo:

- o documento 01, seção 6, listava "Taxas, perdas e outros custos" como **Não**
  no Gratuito e **Sim** no Premium, e repetia "taxas sobre venda, perdas e
  outros custos diretos" entre os itens do Premium;
- o item C-01 do backlog exige campo de taxa sobre venda na **calculadora
  pública**, que por decisão de produto é gratuita e não tem cadastro.

As duas coisas não cabem juntas. A calculadora pública não tem conta, logo não
tem plano a consultar: cobrar por um campo ali significaria ou tirar o campo da
calculadora, ou exigir login para usá-la. Qualquer uma das duas contraria o
princípio 1 do documento 01 — resultado antes do cadastro — e a estratégia de
aquisição da seção 7 do documento 05.

Some-se a isso que a taxa de cartão e a perda de material estão na seção 2 do
documento 01 como parte do problema que o produto diz resolver. Um resultado
que ignora a maquininha não é "um resultado completo, não uma demonstração",
que é o que a mesma seção 6 promete ao plano gratuito.

## Decisão

Taxa sobre venda, perda por material e outros custos diretos funcionam no plano
gratuito, na calculadora pública e no cálculo salvo. A contradição foi
resolvida a favor do C-01.

Os únicos limites do plano gratuito implementados são as contagens do item
F-01, em `backend/src/domain/billing/plan-limits.ts`: dez materiais, três
serviços, cinco custos fixos e janela de cinco cálculos no histórico. Não há
nenhuma outra verificação de plano no cálculo: `salesFeePercent`,
`otherDirectCosts` e a perda por material entram pela rota pública
`POST /api/pricing/calculate`, que não exige autenticação, e são gravados no
serviço sem consultar o plano.

Esta decisão foi tomada durante a construção da API, não pela dona do produto.
Está registrada aqui para que ela possa discordar e reverter com o custo à
vista.

## Alternativas consideradas

- **Manter a tabela e bloquear os campos no gratuito:** preserva o argumento
  comercial do Premium exatamente como estava escrito. Descartada porque
  quebraria o C-01 e obrigaria a calculadora pública a pedir cadastro ou a
  entregar um custo que ignora a maquininha — o oposto do que a seção 6 promete
  ao plano gratuito.
- **Deixar o C-01 parado até a dona do produto decidir:** teria sido a ordem
  correta. Descartada na hora porque a interface fixava a taxa em zero, o que
  contraria o motor de precificação do documento 03 e produz preço errado em
  silêncio — não é um estado em que valha a pena esperar.
- **Liberar apenas a taxa e cobrar por perda e outros custos:** salvaria uma
  linha da tabela e criaria uma regra difícil de explicar em uma tela pequena,
  para um público que não separa esses três nomes.

## Consequências

- o documento 01, seção 6, foi corrigido: a linha da tabela passou a "Sim" nos
  três planos e a lista do Premium não vende mais taxas e perdas como recurso
  exclusivo;
- o Premium perde um argumento de venda. No lançamento ele já era vendido pela
  precificação sem limite, histórico e tabela de preços, conforme a regra de
  comunicação dos planos do próprio documento 01, então o que muda é a
  ilustração, não a promessa;
- a diferença entre gratuito e pago passa a ser inteiramente de **volume e
  organização**, não de qualidade do cálculo. Isso é coerente com o princípio 4
  — o plano pago não invalida a calculadora gratuita;
- reverter é possível e tem preço conhecido: exigiria uma verificação de plano
  no cálculo salvo, uma decisão explícita sobre o que a calculadora pública faz
  com esses campos e a reabertura do C-01. Enquanto este ADR estiver aceito, a
  API se comporta como descrito acima;
- o item C-01 continua pendente na interface: a API aceita a taxa, mas o
  aplicativo ainda precisa exibir o campo.
