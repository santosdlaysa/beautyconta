# ADR-0006 — Analytics com privacidade

**Estado:** Proposto
**Data:** —
**Responsável:** —

## Contexto

A seção 8 do documento 05 define doze eventos e determina que nenhum valor
financeiro ou dado pessoal seja enviado a terceiros. O produto trata dados de
faturamento e custo de negócios individuais, o que torna esse limite mais que
uma preferência.

Sem instrumentação, os critérios de avanço de fase — como "50% das pessoas que
iniciam com dados válidos chegam ao resultado" — não podem ser verificados.

## Decisão

Adotar uma ferramenta de analytics de produto sem cookies de rastreamento
publicitário, escolhida pelo fluxo do Vercel Marketplace na categoria
`analytics` quando a hospedagem do ADR-0005 estiver definida.

Regras invioláveis da instrumentação:

- enviar apenas o nome do evento e propriedades categóricas;
- nunca enviar valor de custo, preço, margem, meta ou faturamento;
- nunca enviar nome, e-mail, telefone ou nome do negócio;
- identificar a usuária apenas por um pseudônimo estável, sem relação com o
  e-mail;
- faixas em vez de números quando a distribuição for necessária, por exemplo
  "duração 0-60, 61-120, 121-240 minutos".

Métricas que dependem de valores financeiros são calculadas no próprio banco,
não em ferramenta de terceiros.

## Alternativas consideradas

- **Google Analytics:** amplo e gratuito, mas orientado a publicidade e com
  histórico de atrito com autoridades de proteção de dados na Europa. O ganho não
  compensa o risco de imagem em um produto que fala de dinheiro alheio.
- **Ferramenta auto-hospedada:** controle máximo dos dados, soma manutenção que a
  equipe não tem capacidade de sustentar agora.
- **Somente registros no próprio banco:** privacidade máxima, custo alto para
  montar funil e retenção.

## Consequências

- o funil de aquisição não terá valores monetários, por decisão consciente;
- o banner de consentimento precisa refletir exatamente o que é coletado;
- eventos novos passam por revisão contra estas regras antes de serem
  implementados;
- a ferramenta escolhida deve constar na política de privacidade.
