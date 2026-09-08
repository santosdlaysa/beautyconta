# ADR-0008 — Clean Architecture na API e no projeto

**Estado:** Aceito
**Data:** 2026-09-08
**Responsável:** Proprietário do produto

## Contexto

O produto tem uma regra de negócio que é o seu ativo principal: o motor de
precificação do documento 03. Essa regra precisa ser idêntica na web, no
aplicativo móvel e em qualquer cálculo futuro, precisa ser testável sem banco e
precisa sobreviver a trocas de ferramenta.

O projeto já acumula decisões que atravessam camadas: Prisma no ADR-0002, dois
processadores de pagamento no ADR-0004, provedor de autenticação ainda indefinido
no ADR-0003 e hospedagem indefinida no ADR-0005. Escrever regra de negócio dentro
de rotas do Next.js amarraria o produto a todas essas escolhas ao mesmo tempo.

## Decisão

Adotar **Clean Architecture** com quatro camadas e uma regra de dependência
única: dependências apontam sempre para dentro.

```text
apresentação  →  aplicação  →  domínio  ←  infraestrutura
```

- **Domínio:** entidades, objetos de valor e o motor de precificação. Sem
  importar framework, ORM, HTTP ou biblioteca de terceiros.
- **Aplicação:** casos de uso, um por intenção, e as portas que eles exigem,
  declaradas como interfaces.
- **Infraestrutura:** implementações dessas portas com Prisma, Mercado Pago,
  RevenueCat, provedor de autenticação e envio de e-mail.
- **Apresentação:** Next.js, componentes React, rotas e ações de servidor.
  Traduz entrada e saída; não contém regra.

O detalhamento — estrutura de pastas, convenções de nome, tratamento de erro,
estratégia de teste por camada e limites do pragmatismo — está no documento 12.

Junto com isso, adotar as práticas de Clean Code aplicáveis a este projeto:
funções pequenas com um propósito, nomes que dispensam comentário, ausência de
número mágico em regra de cálculo e comentário reservado a explicar motivo, não
mecanismo.

## Alternativas consideradas

- **Estrutura padrão do Next.js, com regra em rotas e ações:** menor cerimônia e
  entrega inicial mais rápida. Descartada porque tornaria o motor dependente do
  framework, impedindo o reuso no aplicativo móvel exigido pelo ADR-0004 e
  dificultando os onze testes obrigatórios do documento 03.
- **Arquitetura hexagonal:** equivalente na prática para este caso; a escolha do
  nome Clean Architecture segue a decisão do proprietário do produto.
- **Camadas apenas no backend, interface livre:** aceitável, mas deixaria a
  fronteira ambígua justamente onde o Next.js mistura servidor e cliente.

## Consequências

- existe mais indireção: um caso de uso simples atravessa mais arquivos que uma
  rota direta;
- o custo se paga na troca de ferramenta: substituir Prisma, processador de
  pagamento ou provedor de autenticação passa a alterar apenas a
  infraestrutura;
- o motor de precificação fica testável sem banco, sem HTTP e sem servidor, o
  que viabiliza os testes obrigatórios;
- o pacote de domínio é o mesmo consumido por web e aplicativo móvel,
  atendendo ao ADR-0001;
- a regra de dependência precisa ser verificada automaticamente; sem isso ela é
  violada em semanas;
- código gerado pelo Prisma não vaza para o domínio: entidades de domínio e
  modelos de persistência são distintos, com mapeadores explícitos.
