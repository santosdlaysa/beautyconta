# ADR-0003 — Provedor de autenticação

**Estado:** Substituído
**Data:** 2026-09-09
**Responsável:** Proprietário do produto

Substituído pelo [ADR-0009](0009-autenticacao-propria.md), que decidiu o
contrário: a senha passou a ser guardada no próprio banco, para destravar o
item D-01 sem esperar a hospedagem do ADR-0005. O texto abaixo permanece como
estava, porque o provedor gerenciado continua sendo o destino e os critérios de
escolha desta página seguem valendo quando a decisão for retomada.

## Contexto

`RF-01` exige cadastro por e-mail e senha, recuperação de senha, sessão
persistente e exclusão de conta. O documento 04 registra o provedor como decisão
em aberto; a ideia original citava JWT e OAuth genericamente.

O público não é técnico. Fluxos de login confusos custam ativação logo depois da
calculadora pública, que é o momento de maior intenção. Login social do Google
tende a converter melhor que senha nova, mas não pode ser a única via: parte do
público usa contas que não são Google.

Como o produto guarda dados financeiros do negócio, a exclusão de conta e a
portabilidade previstas em `RF-12` precisam ser operações reais, não manuais.

## Decisão

Adotar um provedor gerenciado com e-mail/senha, Google e código por e-mail, em
vez de implementar autenticação própria. A escolha do provedor específico deve
ser feita executando o fluxo do Vercel Marketplace para a categoria
`authentication`, seguindo a skill `auth`, no momento em que a hospedagem do
ADR-0005 estiver definida.

Candidatos a avaliar nesse fluxo, sem ordem definida antes da consulta: Clerk,
Auth0, Descope e a autenticação nativa do provedor de banco escolhido.

Critérios de desempate, nesta ordem:

1. exclusão de conta e exportação de dados via API;
2. interface traduzível para português do Brasil;
3. custo previsível na faixa de mil a dez mil contas;
4. possibilidade de migrar os usuários para outro provedor.

## Alternativas consideradas

- **Autenticação própria com JWT:** controle total e custo zero de licença, mas
  transfere para o projeto a responsabilidade por hashing, rotação de tokens,
  bloqueio de força bruta e recuperação de senha. Desproporcional para uma
  equipe pequena em fase de validação.
- **Somente login social:** simplifica, mas exclui parte do público.

## Consequências

- a tabela `users` guarda apenas o identificador externo e os dados de perfil,
  nunca a senha;
- o consentimento de `consent_records` é registrado pela aplicação, não pelo
  provedor;
- este ADR só pode ser aceito depois da consulta ao Marketplace, que exige o CLI
  da Vercel instalado e o projeto vinculado.
