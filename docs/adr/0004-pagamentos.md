# ADR-0004 — Pagamentos e assinaturas

**Estado:** Aceito
**Data:** 2026-09-08
**Responsável:** Proprietário do produto

## Contexto

O produto cobra assinatura recorrente de R$ 14,90 e R$ 29,90 por mês, ou
R$ 149,90 e R$ 299,90 por ano, sem catálogo de produtos. O público é brasileiro,
autônomo, e parte relevante não tem cartão de crédito com limite disponível, o
que torna Pix e conta digital meios relevantes, não acessórios.

O autor já opera essa mesma combinação em produção no projeto DocePreço, o que
reduz o risco da decisão e fornece um padrão de implementação testado.

O produto será distribuído também como aplicativo móvel. Assinatura que libera
funcionalidade dentro do aplicativo é, pelas políticas de Apple e Google,
conteúdo digital que precisa ser vendido por compra no aplicativo. Isso cria
três canais de cobrança com regras distintas.

## Decisão

**Web e PWA:** Mercado Pago, que cobre cartão, conta Mercado Pago e Pix, tem
presença consolidada no Brasil e é reconhecido pelo público-alvo, o que reduz
atrito no checkout. A recorrência usa `preapproval`, que suporta Pix Automático:
a pagante autoriza uma vez e as cobranças seguintes ocorrem sozinhas.

**Android e iOS:** compra no aplicativo, intermediada por **RevenueCat**, que
unifica Google Play Billing e App Store em um SDK, uma configuração de produtos
e um webhook único, evitando manter duas implementações de recibo e renovação.

**Fonte de verdade do acesso:** a tabela `subscriptions` do próprio banco,
alimentada pelos webhooks do Mercado Pago e do RevenueCat. Nem a loja nem o
processador decidem o que a assinante pode usar.

O desenho completo, incluindo prevenção de assinatura duplicada, estados,
reembolso por canal e modelo de dados, está no documento 11.

## Alternativas consideradas

- **Stripe:** melhor documentação e portal de assinante, e era a recomendação
  anterior deste ADR. Descartado por cobertura de Pix e reconhecimento de marca
  inferiores no público-alvo brasileiro.
- **RevenueCat também para a web:** unificaria tudo em uma camada, mas o
  processamento web do RevenueCat não contempla Mercado Pago, o que anularia o
  ganho principal da decisão.
- **Cobrança apenas na web, sem lojas:** evitaria a comissão, mas impediria
  distribuir o aplicativo com assinatura, que é parte do plano de produto.
- **Cobrança manual por Pix:** custo operacional alto e sem controle de
  inadimplência. Descartado.

## Consequências

- existem duas integrações de cobrança para manter, com um único modelo interno
  de assinatura conciliando ambas;
- a comissão das lojas reduz a margem das assinaturas originadas em aplicativo;
  o preço permanece igual em todos os canais, conforme o documento 11;
- o cancelamento de assinatura de loja é feito pela própria assinante na loja; o
  produto não consegue cancelá-la, e isso precisa estar nos termos;
- a garantia de reembolso do ADR-0007 não é integralmente cumprível por conta
  própria nas lojas, o que exige texto específico nos termos;
- esta decisão antecipa a necessidade do aplicativo móvel e obriga a revisão do
  ADR-0001;
- nenhum dado de cartão trafega pelo BeautyConta;
- permanecem a confirmar: comissões vigentes dos programas de pequenos
  desenvolvedores e emissão de nota fiscal por canal;
- existe implementação de referência em produção, o projeto DocePreço, cujas
  lições estão na seção 12 do documento 11 e devem ser seguidas desde o início.
