# ADR-0001 — Web responsiva/PWA antes de app nativo

**Estado:** Proposto
**Data:** —
**Responsável:** —

## Contexto

A ideia original previa React Native com Expo para mobile e Next.js para web. O
documento 04 propõe web-first e deixa a questão em aberto. O público é
mobile-first: a profissional usa o produto entre atendimentos, no celular.

O objetivo da primeira fase é validar se o cálculo é útil, com 20 a 50
profissionais reais. Manter duas plataformas antes disso multiplica o custo de
cada mudança de fluxo, que nesta fase será frequente.

Há um fator decisivo de aquisição: a estratégia da seção 7 do documento 05
depende de busca no Google levando à calculadora pública. Conteúdo indexável
exige web. Um app nativo não recebe esse tráfego.

## Decisão

Entregar web responsiva com PWA instalável nas fases 1 a 3. Avaliar app nativo
somente quando a Fase 4 exigir recursos que a web não entrega bem: notificações
confiáveis para lembretes de agenda e uso offline prolongado.

Manter a lógica de precificação em um pacote isolado, sem dependência de DOM ou
de framework, para que um app nativo futuro a reutilize sem reescrita.

## Alternativas consideradas

- **Nativo e web simultâneos:** cobertura maior, custo de manutenção dobrado
  numa fase em que o produto ainda muda de forma toda semana.
- **Somente nativo:** perde a aquisição orgânica, que é a principal aposta de
  crescimento.
- **Somente web sem PWA:** mais simples, mas sem ícone na tela inicial, o que
  reduz o retorno recorrente.

## Revisão de 2026-09-08

O ADR-0004 decidiu vender assinatura também por Google Play e App Store, o que
exige aplicativo publicado nas lojas. Isso não invalida a decisão acima, mas
altera o gatilho: o aplicativo móvel deixa de ser motivado apenas por
notificações e uso offline e passa a ser também um canal de receita.

Sequência revista:

1. web e PWA nas fases 1 e 2, com cobrança apenas pelo Mercado Pago;
2. aplicativo móvel com compra no aplicativo quando houver assinantes web
   pagando e retenção medida;
3. as lojas ampliam a distribuição, mas não são pré-requisito para faturar.

A aquisição continua dependendo de conteúdo indexável, que só a web entrega.
Publicar nas lojas antes de haver retenção significa pagar comissão e sustentar
duas plataformas para validar o que a web valida sozinha.

## Consequências

- notificações push ficam limitadas até existir app nativo;
- a instalação como PWA precisa ser explicada na interface, porque não é óbvia;
- o pacote de precificação isolado passa a ser requisito de arquitetura, não
  preferência;
- a decisão deve ser reavaliada quando a agenda entrar em desenvolvimento;
- a lógica de precificação em pacote isolado passa a ser condição para o
  aplicativo móvel, não conveniência, conforme o documento 12.
