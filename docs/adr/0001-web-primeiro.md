# ADR-0001 — App mobile Expo como produto principal

**Estado:** Aceito
**Data:** 2026-09-09
**Responsável:** Produto BeautyConta

## Contexto

A ideia prevê React Native com Expo para o aplicativo e Next.js para a web. O
público é mobile-first: a profissional usa o produto entre atendimentos, no
celular. A primeira validação deve priorizar uso recorrente no app, com 20 a 50
profissionais reais.

Há um fator decisivo de aquisição: a estratégia da seção 7 do documento 05
depende de busca no Google levando à calculadora pública. Conteúdo indexável
exige web. Um app nativo não recebe esse tráfego.

## Decisão

O produto principal será um app mobile em React Native com Expo SDK 57. A pasta
`mobile/` recebe primeiro os fluxos de cálculo, onboarding, conta e assinatura.
Manteremos `web/` como canal complementar para landing pages, SEO e calculadoras
públicas. A lógica de precificação permanece isolada e compartilhável entre
mobile, API e web.

Manter a lógica de precificação em um pacote isolado, sem dependência de DOM ou
de framework, para que o app Expo, a API e a web a reutilizem sem reescrita.

## Alternativas consideradas

- **Nativo e web simultâneos:** cobertura maior, custo de manutenção dobrado
  numa fase em que o produto ainda muda de forma toda semana.
- **Somente nativo:** perde a aquisição orgânica, que é a principal aposta de
  crescimento.
- **Somente web sem PWA:** mais simples, mas sem ícone na tela inicial, o que
  reduz o retorno recorrente.

## Consequências

- o app mobile precisa de builds e testes em Android/iOS;
- publicação nas lojas e regras de compra no aplicativo entram no planejamento;
- a web pode evoluir em paralelo sem bloquear o MVP mobile;
- o pacote de precificação isolado é requisito para evitar divergência entre
  mobile, API e web.
