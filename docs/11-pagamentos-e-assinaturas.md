# Pagamentos e assinaturas

## 1. Objetivo

Definir como a assinatura é cobrada em cada canal, quem é a fonte de verdade do
acesso e o que precisa existir para que uma mesma conta funcione na web e no
aplicativo sem cobrança duplicada.

Decisão de origem: ADR-0004.

## 2. Canais de cobrança

| Canal | Processador | Meios |
|---|---|---|
| Web e PWA | Mercado Pago | Cartão, conta Mercado Pago e Pix Automático |
| Android | Google Play Billing | Meios da conta Google |
| iOS | App Store In-App Purchase | Meios da conta Apple |

RevenueCat é a camada que unifica Google Play e App Store: um SDK no aplicativo,
uma configuração de produtos e um webhook único para renovação, cancelamento,
período de carência e reembolso.

**RevenueCat não processa o Mercado Pago.** Isso não é limitação a contornar com
gambiarra; é o motivo pelo qual a seção 3 existe.

## 3. Fonte de verdade do acesso

A regra central deste documento:

> Quem decide o que a assinante pode usar é o BeautyConta, não a loja e não o
> processador.

A tabela `subscriptions` do próprio banco é a fonte de verdade. Ela é alimentada
por duas origens de eventos e consultada por todos os clientes.

```text
Google Play  ─┐
              ├─ RevenueCat ─ webhook ─┐
App Store    ─┘                        │
                                       ├─ BeautyConta: subscriptions ─ acesso
Mercado Pago ─ webhook ────────────────┘
```

Consequências obrigatórias:

- o aplicativo nunca decide acesso lendo o SDK local; ele pergunta ao servidor;
- a web nunca decide acesso lendo o Mercado Pago; ela lê `subscriptions`;
- todo webhook é idempotente e registra o evento bruto antes de processar;
- divergência entre origem e banco gera alerta, não correção silenciosa.

## 4. Assinatura duplicada

O risco real: a mesma pessoa assina pela web e depois pelo aplicativo, e passa a
pagar duas vezes.

Regras:

- antes de abrir qualquer checkout, o servidor verifica se já existe assinatura
  ativa em outro canal;
- havendo assinatura ativa, o aplicativo não oferece compra: mostra o plano
  atual e onde ele é gerenciado;
- se a duplicidade ocorrer mesmo assim, vale a assinatura mais antiga, a mais
  recente é sinalizada para reembolso e a situação vira alerta de suporte;
- o cancelamento é sempre feito no canal que originou a cobrança, e a interface
  precisa dizer isso com clareza, porque o BeautyConta não consegue cancelar uma
  assinatura da App Store.

## 5. Comissão das lojas e preço por canal

Google e Apple retêm comissão sobre a assinatura. Nas condições para pequenos
desenvolvedores, a taxa costuma ser de 15%; fora delas, chega a 30%. **Os
percentuais e os critérios de enquadramento devem ser confirmados nos programas
vigentes antes do lançamento**, porque mudam com frequência e afetam diretamente
a margem.

Em R$ 14,90, uma comissão de 15% retém cerca de R$ 2,24; de 30%, cerca de
R$ 4,47. O Mercado Pago cobra taxa por transação, muito menor, mas com prazo de
liberação a considerar no caixa.

Decisão de preço:

- o preço anunciado é o mesmo em todos os canais, para não punir quem assina
  pelo aplicativo nem gerar sensação de propaganda enganosa;
- a diferença de margem entre canais é acompanhada como métrica de receita, não
  repassada à assinante;
- se a proporção de assinaturas por loja tornar a margem inviável, a resposta é
  revisar o preço base, não criar preço por canal.

## 6. Regras das lojas

Assinatura que libera funcionalidade dentro do aplicativo é conteúdo digital e,
pelas políticas de Apple e Google, precisa ser vendida por compra no aplicativo.
Não é possível, dentro do app, direcionar a usuária ao checkout web para escapar
da comissão.

As regras sobre links externos vêm mudando por decisão judicial e regulatória em
diferentes países, inclusive no Brasil. **Antes da primeira submissão, as
políticas vigentes devem ser lidas na íntegra**, e o que este documento afirma
sobre elas deve ser reconferido.

Postura adotada: cumprir a regra mais restritiva. O aplicativo vende por compra
no aplicativo, sem menção a preço externo. A web vende pelo Mercado Pago. A
comunicação fora do aplicativo pode citar livremente o checkout web.

## 7. Impacto no roadmap

A cobrança por Google Play e App Store só existe com aplicativo publicado nas
lojas. Isso antecipa o aplicativo móvel, que o ADR-0001 havia empurrado para
depois da Fase 3.

Sequência resultante:

1. Fases 1 e 2 na web, com cobrança apenas pelo Mercado Pago;
2. aplicativo móvel com RevenueCat quando houver assinantes web pagando e
   retenção medida;
3. as lojas ampliam distribuição; elas não são pré-requisito para faturar.

Publicar nas lojas antes de haver retenção significa pagar comissão e o custo de
duas plataformas para validar algo que a web valida sozinha.

## 8. Modelo de dados

A tabela `subscriptions` do documento 04 passa a distinguir canal e origem:

- `channel`: `WEB`, `ANDROID` ou `IOS`;
- `provider`: `MERCADO_PAGO` ou `REVENUECAT`;
- `provider_customer_id` e `provider_subscription_id`;
- `revenuecat_app_user_id`, quando o canal for de loja;
- `mp_preapproval_id`, quando o canal for web;
- `plan`, `status`, `current_period_start`, `current_period_end`,
  `cancel_at_period_end`;
- `billing_period`: `MONTHLY` ou `ANNUAL`.

Nova tabela `billing_events`:

- id, business_id, subscription_id;
- `source`: `MERCADO_PAGO` ou `REVENUECAT`;
- `external_event_id`, único, que garante a idempotência;
- `type`, `payload_json`, `processed_at`, `created_at`.

Nova tabela `revenuecat_aliases`, exigida pela seção 12:

- id, business_id, `rc_app_user_id` único, created_at.

O identificador de usuário enviado ao RevenueCat é o identificador interno do
negócio, nunca o e-mail, para não expor dado pessoal a terceiro sem necessidade,
conforme o `RF-12`.

## 9. Estados de assinatura

Estados normalizados, independentes de canal: `active`, `in_grace`,
`past_due`, `canceled`, `expired`, `refunded`, `paused`.

Regras:

- `in_grace` e `past_due` mantêm o acesso e avisam sobre a pendência;
- `expired` e `refunded` rebaixam para o plano gratuito sem apagar dados, que
  passam a ser somente leitura conforme o `RF-11`;
- reembolso feito pela loja chega por webhook e precisa ser tratado, inclusive
  quando ocorre meses depois;
- estorno no Mercado Pago recebe o mesmo tratamento.

## 10. Reembolso por canal

O ADR-0007 garante devolução em até sete dias. A execução muda conforme o canal:

- web: o reembolso é feito pelo BeautyConta no Mercado Pago;
- lojas: o reembolso é solicitado pela própria assinante à Apple ou ao Google,
  que decidem. O produto deve explicar o caminho e, quando a loja negar, avaliar
  compensação em período de acesso.

Essa diferença precisa constar nos termos de uso, porque a promessa de reembolso
não é integralmente cumprível por conta própria nas lojas.

## 11. Ambiente e testes

- Mercado Pago em ambiente de testes, com credenciais separadas por ambiente;
- RevenueCat em modo sandbox, com assinaturas de teste em ambas as lojas;
- testes obrigatórios: renovação, falha de cobrança, período de carência,
  cancelamento, reembolso, upgrade de Premium para Master, mudança de mensal
  para anual e restauração de compra após reinstalação;
- webhook duplicado precisa ser exercitado em teste, porque acontece em
  produção;
- nenhum dado de cartão trafega ou é armazenado pelo BeautyConta.

## 12. Implementação de referência: DocePreço

O projeto DocePreço, do mesmo autor, já opera esta combinação em produção:
Mercado Pago na web e RevenueCat nas lojas, sobre a mesma separação em camadas
do documento 12. As lições abaixo vêm de código em uso e devem ser aplicadas
desde a primeira linha, porque cada uma delas custou um problema real.

### Pix recorrente existe e é a via preferida

O Mercado Pago oferece assinatura por `preapproval`: a pagante autoriza uma
única vez pelo `init_point` e as cobranças seguintes ocorrem sozinhas na
recorrência definida, inclusive por Pix Automático. Isso resolve a dúvida que
motivou o ADR-0004.

Consequência: o BeautyConta usa `preapproval` para assinatura recorrente, e
pagamento avulso por QR Code apenas onde a recorrência não se aplica. O
`external_reference` enviado ao Mercado Pago é o identificador do registro
interno, e é ele que liga o webhook de volta à assinatura.

### O identificador anônimo do RevenueCat

O RevenueCat envia `app_user_id` anônimo, no formato `$RCAnonymousID:...`,
quando a compra acontece antes de o aplicativo identificar a usuária. Sem
tratamento, o webhook chega e não encontra a conta.

Busca em cascata, nesta ordem: identificador direto, `original_app_user_id`,
aliases presentes no evento e, por fim, uma tabela `revenuecat_aliases` que
guarda todos os identificadores já vistos para aquela conta. Todo identificador
conhecido é gravado como alias ao processar um evento.

Quando ainda assim a conta não é encontrada, responder **200**. Responder erro
faz o RevenueCat reenviar o evento indefinidamente.

### Nunca conceder acesso pelo que o cliente afirma

O aplicativo avisa o servidor após compra ou restauração, porque o webhook pode
falhar ou chegar com identificador anônimo. Esse aviso é um gatilho, não uma
prova.

Regras:

- ao receber o aviso, o servidor consulta a API do RevenueCat com a chave
  secreta e usa a data de expiração dela, ignorando o que veio no corpo;
- o aviso do cliente só pode **elevar** o plano; rebaixamento acontece
  exclusivamente por webhook de expiração ou falha de cobrança;
- o RevenueCat tem atraso de propagação: uma segunda tentativa após alguns
  segundos evita negar acesso a quem acabou de pagar;
- sem a chave secreta configurada, o caminho que confia no cliente é uma brecha
  de acesso gratuito e não deve existir em produção.

### Um único campo decide o plano

No DocePreço, manter dois campos para a mesma verdade — um indicador booleano e
o nível do plano — produziu registros inconsistentes: a rotina de expiração
limpava um e deixava o outro, e contas expiradas apareciam como pagantes.

No BeautyConta, o plano vigente é derivado de `subscriptions`. Não existe campo
booleano paralelo em `businesses`. Qualquer valor exibido na interface vem
dessa única origem.

### Nomes de produto que se confundem

Identificadores como `premium_master` contêm ao mesmo tempo "premium" e
"master". Classificar por continência sem ordem faz o Master virar Premium.

Regra: testar sempre o nível mais alto primeiro, e manter um mapa explícito de
identificador de produto para plano, em vez de inferir por texto contido.

### Histórico de eventos

O DocePreço mantém uma tabela de eventos de assinatura com o valor pago, usada
para conferência e suporte. É o mesmo papel de `billing_events` na seção 8, com
uma adição: guardar também o valor efetivamente pago na moeda da loja, que é o
único lugar onde a comissão pode ser conferida.

### Mudança de plano no meio do período

O DocePreço calcula o valor proporcional ao migrar de plano e oferece uma
prévia antes de cobrar. O BeautyConta deve seguir o mesmo caminho para o upgrade
de Premium para Master, e a prévia é requisito, não cortesia: cobrança
proporcional sem demonstração prévia gera contestação.

## 13. Pendências

- confirmar comissões e critérios dos programas de pequenos desenvolvedores;
- definir emissão de nota fiscal da assinatura por canal, lembrando que nas
  lojas a relação comercial com a assinante é intermediada;
- definir o tratamento de assinantes que trocam de canal;
- decidir se o pagamento avulso por QR Code, com aprovação manual, é mantido
  como alternativa para quem não autoriza recorrência.
