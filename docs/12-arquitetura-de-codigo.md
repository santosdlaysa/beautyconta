# Arquitetura de código e convenções

Decisão de origem: ADR-0008.

## 1. A regra que sustenta tudo

Dependências apontam para dentro. Uma camada só conhece as camadas mais
internas.

```text
apresentação  →  aplicação  →  domínio  ←  infraestrutura
```

O domínio não importa nada de fora. Se um arquivo de domínio precisar de Prisma,
de `fetch`, de `next/*` ou de uma variável de ambiente, a modelagem está errada
— não é caso de exceção.

## 2. Estrutura de pastas

```text
src/
  domain/
    pricing/            motor do documento 03
      calculate-price.ts
      rounding.ts
      goal.ts
      errors.ts
    catalog/            unidades e normalização do documento 06
    equipment/          reserva do documento 07
    shared/             Money, Quantity, Percentage, Duration
  application/
    use-cases/
      calculate-service-price.ts
      save-calculation.ts
      register-material.ts
      start-subscription.ts
    ports/
      material-repository.ts
      calculation-repository.ts
      subscription-gateway.ts
      clock.ts
    errors.ts
  infrastructure/
    persistence/prisma/
      client.ts
      material-repository.ts
      mappers/
    billing/
      mercado-pago/
      revenuecat/
    auth/
    telemetry/
  app/                  App Router do Next: rotas finas que só delegam
  presentation/
    http/               handlers e ações de servidor
    web/                componentes React
    mappers/            entrada e saída, validação de borda
  config/
prisma/
  schema.prisma
  migrations/
tests/
  domain/
  application/
  integration/
  e2e/
```

O App Router precisa ficar em `app/` ou `src/app/`; é imposição do Next.js, não
escolha de arquitetura. Por isso `src/app` existe ao lado de `src/presentation`
e guarda apenas arquivos finos — `page.tsx`, `layout.tsx` e `route.ts` — que
delegam para `presentation/web` e `presentation/http`. Nenhuma regra vive ali.

A migração já foi feita: `lib/pricing.ts` virou `src/domain/pricing`,
`components/` virou `src/presentation/web` e `app/` virou `src/app`. O atalho
`@/*` aponta para `src/*`.

### Alinhamento com o DocePreço

O backend do DocePreço já usa esta separação, com os nomes
`domain/entities`, `domain/repositories`, `domain/services`,
`application/use-cases`, `application/services`,
`infrastructure/repositories`, `infrastructure/services`,
`presentation/controllers`, `presentation/routes` e
`presentation/middleware`.

O BeautyConta adota os mesmos nomes onde eles se aplicam, para que a leitura de
um projeto sirva ao outro. As diferenças são deliberadas:

- `domain/pricing` isola o motor como pacote reutilizável pelo aplicativo
  móvel, em vez de dispersá-lo entre serviços de domínio;
- as portas ficam em `application/ports`, e não apenas como repositórios de
  domínio, porque incluem processador de pagamento, relógio e telemetria;
- `presentation/http` cobre rotas e ações de servidor do Next.js, no lugar de
  controladores e rotas de um servidor Express separado.

## 3. O que vive em cada camada

### Domínio

Entidades, objetos de valor e regras de cálculo. Cabe aqui a resposta para "qual
é o preço recomendado deste serviço?".

Objetos de valor obrigatórios, porque este é um produto financeiro:

- `Money`: inteiro de centavos, com soma, subtração e divisão explícitas;
- `Quantity`: decimal exato com unidade;
- `Percentage`: fração validada na faixa permitida;
- `Duration`: minutos, validados entre 1 e 1440.

Nenhuma operação monetária usa ponto flutuante binário. `Money` não expõe
`number` bruto para cálculo; apenas para formatação na borda.

### Aplicação

Casos de uso, um por intenção da usuária, nomeados com verbo:
`CalculateServicePrice`, `SaveCalculation`, `StartSubscription`. Cada um recebe
um comando simples, orquestra domínio e portas, devolve um resultado simples.

Portas são interfaces declaradas aqui, não na infraestrutura. Quem precisa
define o contrato; quem implementa obedece.

Transação pertence a esta camada, como unidade de trabalho, e não é decidida
dentro do domínio.

### Infraestrutura

Implementa as portas. Um repositório Prisma nunca devolve modelo do Prisma para
fora: converte em entidade de domínio por um mapeador explícito, em
`persistence/prisma/mappers`.

As integrações do documento 11 vivem aqui, cada uma atrás de uma porta, o que
permite que Mercado Pago e RevenueCat coexistam sem contaminar os casos de uso.

### Apresentação

Rotas, ações de servidor e componentes. Valida entrada, chama um caso de uso,
formata a saída. Não faz regra, não fala com o banco, não chama a infraestrutura
diretamente.

Componente React não formata dinheiro por conta própria: usa o formatador
compartilhado, para que preço apareça igual em toda a interface.

## 4. Tratamento de erro

Duas categorias, tratadas de formas diferentes:

- **Erro esperado** — entrada inválida, limite de plano atingido, soma de taxa e
  margem maior ou igual a 100%. É valor de retorno, do tipo
  `Result<T, DomainError>`, não exceção. Carrega o campo culpado, conforme o
  item A-02 do documento 09.
- **Falha inesperada** — banco fora, webhook malformado. É exceção, registrada
  com contexto e traduzida em erro genérico na borda.

Mensagem de erro de domínio é escrita para a usuária, em português, sem jargão.
A tradução para HTTP acontece só na apresentação.

## 5. Convenções de Clean Code aplicáveis

- nome revela intenção: `allocatedFixedCost`, nunca `cf2` ou `tmp`;
- função faz uma coisa; se o nome precisa de "e", são duas funções;
- nada de número mágico em cálculo: constantes nomeadas, com a referência à
  seção do documento 03;
- comentário explica motivo, não mecanismo; comentário que descreve o que a
  linha faz é sinal de nome ruim;
- sem abreviação inventada em nome de domínio: `CM`, `MO` e `CF` existem nas
  fórmulas do documento 03, e no código viram `materialCost`, `laborCost` e
  `allocatedFixedCost`;
- dependência entra por parâmetro ou construtor, nunca por importação direta de
  módulo concreto dentro de domínio ou aplicação;
- arquivo com mais de uma responsabilidade é dividido antes de crescer.

## 6. Testes por camada

| Camada | Tipo | Regra |
|---|---|---|
| Domínio | Unitário | Sem dublê, sem banco, sem rede. Cobre os onze casos do documento 03 |
| Aplicação | Unitário | Portas substituídas por implementações em memória |
| Infraestrutura | Integração | Banco real de teste; verifica mapeadores e transações |
| Apresentação | Ponta a ponta | Primeiro cálculo, cadastro e assinatura |

O exemplo completo da seção 8 do documento 03 é teste de regressão do domínio e
não pode ser alterado sem incrementar `calculation_version`.

## 7. Verificação automática da arquitetura

A regra de dependência precisa falhar o build quando violada, não depender de
revisão humana.

- `domain` não pode importar `application`, `infrastructure`, `presentation`,
  `@prisma/client` nem `next`;
- `application` não pode importar `infrastructure` nem `presentation`;
- `presentation` não pode importar `infrastructure` diretamente.

Implementar com regra de importação no ESLint, apoiada por limites de projeto no
TypeScript. Um teste que percorre os arquivos e verifica as importações também
serve, e é melhor que nada.

## 8. Onde ser pragmático

Clean Architecture aqui existe para proteger o cálculo e as integrações, não
para gerar cerimônia uniforme.

- leitura simples para tela pode ir da apresentação a uma consulta de leitura
  dedicada, sem caso de uso, desde que não contenha regra;
- não criar interface para dependência que nunca terá segunda implementação, com
  exceção das que precisam ser substituídas em teste, como relógio e repositório;
- não criar entidade de domínio para tabela puramente operacional, como
  `billing_events`;
- a calculadora pública roda o domínio no cliente, sem passar pela aplicação,
  porque não persiste nada; ao salvar, o cálculo é refeito no servidor, que é a
  única fonte confiável.

## 9. Ordem de implementação

Coerente com a etapa A do documento 09:

1. `domain/shared` com `Money`, `Quantity`, `Percentage` e `Duration`;
2. `domain/pricing` completo, com os testes obrigatórios;
3. portas e primeiros casos de uso;
4. Prisma e mapeadores atrás das portas;
5. migração da apresentação atual para `src/presentation`;
6. verificação automática da regra de dependência no CI.
