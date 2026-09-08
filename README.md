# BeautyConta

> **Saiba quanto cobrar sem trabalhar no prejuízo.**

BeautyConta é um produto de precificação e gestão para profissionais autônomos da
beleza. O produto começa resolvendo a dúvida “quanto devo cobrar por este
serviço?” e evolui para apoiar decisões sobre lucro, clientes, agenda, estoque e
finanças.

## Status

Documentação concluída e pronta para desenvolvimento parcial.

- nome, planos, preços e limites definidos;
- motor de precificação, dados, catálogos, painel e identidade documentados;
- backlog do MVP escrito com critérios de aceite;
- decisões técnicas aceitas: Prisma no ADR-0002, Mercado Pago e RevenueCat no
  ADR-0004, Clean Architecture no ADR-0008;
- quatro decisões seguem propostas — autenticação, hospedagem, analytics e
  política de assinatura — e bloqueiam conta, publicação e cobrança.

O código atual entrega a página pública e a calculadora por valores agregados.
As etapas A, B e C do [backlog](docs/09-backlog-do-mvp.md) podem começar; as
demais aguardam os ADRs 0003, 0005, 0006 e 0007.

## Documentação

1. [Visão do produto e planos](docs/01-produto-e-planos.md)
2. [Requisitos e jornadas](docs/02-requisitos-e-jornadas.md)
3. [Motor de precificação](docs/03-motor-de-precificacao.md)
4. [Arquitetura e dados](docs/04-arquitetura-e-dados.md)
5. [Roadmap, validação e métricas](docs/05-roadmap-e-validacao.md)
6. [Catálogos e listas de referência](docs/06-catalogos-e-listas.md)
7. [Equipamentos e reserva para reposição](docs/07-equipamentos-e-depreciacao.md)
8. [Painel e relatórios](docs/08-painel-e-relatorios.md)
9. [Backlog do MVP](docs/09-backlog-do-mvp.md)
10. [Identidade visual mínima](docs/10-identidade-visual.md)
11. [Pagamentos e assinaturas](docs/11-pagamentos-e-assinaturas.md)
12. [Arquitetura de código e convenções](docs/12-arquitetura-de-codigo.md)

Decisões técnicas: [registros de arquitetura](docs/adr/README.md), sete ADRs
ainda no estado proposto.

## Escopo da primeira versão

O MVP terá:

- calculadora pública e sem cadastro;
- cadastro e autenticação;
- perfil do negócio;
- materiais e custos fixos;
- configuração da hora de trabalho;
- serviços e composição de materiais;
- preço recomendado, análise do preço atual e simulador;
- histórico básico conforme o plano;
- assinatura e aplicação dos limites Gratuito, Premium e Master.

Clientes, agenda, financeiro completo, estoque e IA estão documentados como
evoluções e não fazem parte do primeiro lançamento.

## Nome e posicionamento

**Nome:** BeautyConta, decidido em 2026-09-08  
**Descritor:** Precificação e gestão para profissionais da beleza  
**Frase principal:** Saiba quanto cobrar sem trabalhar no prejuízo.  
**Alternativa curta:** Seu talento tem preço. A BeautyConta faz a conta.

O nome permite começar com unhas sem limitar a expansão para cílios, cabelo,
sobrancelhas e estética, e suporta submarcas por módulo. A decisão está
registrada na seção 7 do [documento de produto](docs/01-produto-e-planos.md).

