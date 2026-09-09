# BeautyConta

> **Saiba quanto cobrar sem trabalhar no prejuízo.**

BeautyConta é um produto de precificação e gestão para profissionais autônomos da
beleza. O produto começa resolvendo a dúvida “quanto devo cobrar por este
serviço?” e evolui para apoiar decisões sobre lucro, clientes, agenda, estoque e
finanças.

## Status

Documentação concluída, API e banco de dados no ar, app mobile Expo em
desenvolvimento.

- nome, planos, preços e limites definidos;
- motor de precificação, dados, catálogos, painel e identidade documentados;
- backlog do MVP escrito com critérios de aceite;
- decisões técnicas aceitas: Prisma no ADR-0002, Mercado Pago e RevenueCat no
  ADR-0004, Clean Architecture no ADR-0008;
- etapas A e B do [backlog](docs/09-backlog-do-mvp.md) concluídas: motor
  completo com a suíte obrigatória do documento 03, esquema no PostgreSQL e
  catálogos servidos pela API;
- API dos cadastros da etapa E pronta e testada; falta a interface consumi-la;
- hospedagem, analytics e política de assinatura seguem propostas e bloqueiam
  publicação, métricas e cobrança.

O app mobile é a experiência principal; a web existe para aquisição orgânica,
landing pages e calculadoras públicas.

A autenticação saiu do bloqueio do ADR-0003 por decisão da dona do produto, com
e-mail e senha guardados no próprio banco. Recuperação de senha e verificação de
e-mail continuam pendentes, porque dependem de um serviço de e-mail ainda não
contratado.

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

Decisões técnicas: [registros de arquitetura](docs/adr/README.md); quatro ADRs
ainda estão no estado proposto.

## Executar o app Expo

```powershell
cd mobile
npx expo start
```

Escaneie o QR code com o Expo Go. Para visualizar no navegador, pressione `w`
no terminal ou execute diretamente:

```powershell
cd mobile
npx expo start --web
```

Para executar em um dispositivo/emulador específico, use `a` (Android) ou `i`
(iOS) no terminal do Expo.

O app descobre o endereço da API a partir do host do Metro, então em aparelho
físico com Expo Go costuma funcionar sem configuração. Quando não funcionar —
rede com isolamento de clientes, túnel, emulador — copie `mobile/.env.example`
para `mobile/.env` e defina `EXPO_PUBLIC_API_URL` com o IP da máquina que roda
a API, não `localhost`: no aparelho, `localhost` é o próprio aparelho.

## API

Node.js com Express e TypeScript em `backend/`, organizada nas camadas do
[documento 12](docs/12-arquitetura-de-codigo.md): o domínio não conhece HTTP nem
Prisma, a aplicação declara as portas e a infraestrutura as implementa. A regra
de dependência é verificada pelo ESLint e falha o build quando violada.

Duas convenções valem para toda a API de recursos: **dinheiro em centavos
inteiros**, com o sufixo `Cents`, e **percentual em pontos percentuais**, com o
sufixo `Percent`. A calculadora pública é a exceção deliberada — responde em
reais, como o aplicativo Expo já consome.

### Rotas

Público, sem cadastro:

| Método | Rota | O que faz |
|---|---|---|
| `POST` | `/api/pricing/calculate` | Preço recomendado a partir de números avulsos |
| `POST` | `/api/pricing/goal` | Simulador de meta (projeção, não garantia) |
| `GET` | `/api/catalog` | Segmentos, unidades e categorias do documento 06 |

Conta e sessão. A identidade viaja como `Authorization: Bearer <token>`; o
banco guarda apenas o resumo SHA-256 do token, e a senha é derivada com scrypt:

| Método | Rota | O que faz |
|---|---|---|
| `POST` | `/api/users` | Cadastro; já devolve a sessão |
| `POST` | `/api/sessions` | Entrada por e-mail e senha |
| `DELETE` | `/api/sessions/current` | Sai da conta neste aparelho |
| `PATCH` | `/api/users/me/password` | Troca a senha e derruba as sessões abertas |
| `GET PATCH DELETE` | `/api/users/me` | Perfil e exclusão efetiva da conta |
| `POST GET` | `/api/businesses` | Cria e lista negócios da usuária |
| `GET PATCH` | `/api/businesses/:id` | Nome, segmento, modelo de trabalho e fuso |
| `GET PUT` | `/api/businesses/:id/settings` | Retirada desejada, horas produtivas e rateio |
| `GET` | `/api/businesses/:id/export` | Exportação completa dos dados (`RF-12`) |

Por negócio, sob `/api/businesses/:businessId`:

| Método | Rota | O que faz |
|---|---|---|
| `POST GET` | `/materials` | Materiais com unidade, perda e data da compra |
| `PATCH DELETE` | `/materials/:id` | Editar; excluir só fora de qualquer serviço |
| `POST` | `/materials/:id/archive` · `/restore` | Arquivar preservando o histórico |
| `POST GET PATCH DELETE` | `/fixed-costs[/:id]` | Custos fixos e total mensal ativo |
| `POST GET PATCH DELETE` | `/services[/:id]` | Serviços com composição de materiais |
| `POST` | `/services/:id/archive` · `/restore` | Arquivar; excluir só sem histórico |
| `POST` | `/services/:id/duplicate` | Variação sem recadastrar a composição |
| `POST` | `/services/:id/pricing` | Calcula; com `save: true` grava no histórico |
| `GET POST` | `/calculations` | Histórico imutável e cálculo avulso salvo |
| `POST GET PATCH DELETE` | `/equipment[/:id]` | Cadastro do documento 07 |
| `GET` | `/subscription` | Plano em vigor, limites e canal de gestão |
| `POST` | `/subscription/checkout` · `/:id/cancel` | Assinatura pelo canal web |

Agenda, sob `/api/businesses/:businessId/appointments`: criar, listar, obter,
editar, `POST /:id/settle` para dar baixa e `GET /appointments/summary`.

> **Atenção de escopo:** a agenda pertence ao plano Master e a seção 10 do
> [backlog](docs/09-backlog-do-mvp.md) a coloca fora do MVP, junto com clientes,
> financeiro e estoque. A API existe; vender o recurso como disponível depende
> da regra de comunicação dos planos da seção 6 do documento 01.

Webhooks de cobrança, chamados pelo processador:
`POST /api/billing/webhooks/mercado-pago` e `.../revenuecat`. O evento bruto é
gravado antes de qualquer processamento; o reenvio de um evento já processado
devolve `duplicated`, e o reenvio de um que ficou pela metade retoma de onde
parou.

**Os dois webhooks recusam tudo enquanto o segredo não estiver configurado.**
A falha é fechada de propósito: quem esquecesse a variável de ambiente não veria
erro nenhum, só uma tabela de eventos de cobrança que qualquer pessoa com a URL
poderia escrever. As variáveis estão em `backend/.env.example`.

As rotas abertas — entrada, cadastro, calculadora e webhooks — têm teto de
requisição. Sem ele, `POST /api/sessions` aceitava força bruta ilimitada e,
como cada tentativa custa dezenas de milissegundos de scrypt no threadpool do
Node, derrubava junto a calculadora pública.

### Regras verificadas no servidor

- **Isolamento por negócio** (B-03): toda consulta filtra pelo negócio
  autorizado; negócio alheio e negócio inexistente recebem a mesma resposta.
- **Limites do plano gratuito** (F-01): 1 negócio, 10 materiais, 3 serviços,
  5 custos fixos e os 5 últimos cálculos no histórico. Ao atingir o limite a resposta é `402`
  explicando o que muda ao assinar, e nada do que já existe é apagado.
- **Histórico imutável** (E-05): o cálculo guarda a fotografia das entradas;
  editar um material depois não altera cálculo antigo. Excluir um material em
  uso ou um serviço que já gerou cálculo é recusado com `409` e o convite para
  arquivar — a chave estrangeira permitiria a exclusão, mas o histórico perderia
  em silêncio de onde veio aquele preço.
- **Fonte de verdade do acesso**: quem decide o plano é a tabela
  `subscriptions`, nunca o processador nem o SDK da loja. Compra de ambiente de
  teste do RevenueCat é gravada para auditoria e não concede plano.
- **Exclusão efetiva** (`RF-01` e `RF-12`): apagar a conta leva junto negócios,
  cadastros, composição de serviços e histórico, em cascata no banco.
- **Exportação** (`RF-12`): leva tudo, inclusive arquivados, inativos e o
  histórico além da janela do plano. Negar a cópia do que é da pessoa por causa
  de plano seria usar a proteção de dados como alavanca de venda.
- **Limite de plano sem corrida**: a contagem e a inserção acontecem na mesma
  transação, com bloqueio da linha dona da cota. Sem isso, requisições paralelas
  liam a mesma contagem e passavam todas — medido contra o banco, 25 inserções
  simultâneas contra um teto de 10 hoje resultam em 10 criadas e 15 recusadas.

A autenticação por senha própria contraria o ADR-0003, que decidiu adotar um
provedor gerenciado e deixou o item D-01 bloqueado. Ela existe para destravar o
aplicativo e precisa ser revista quando o provedor for escolhido: nesse dia, a
migração lê `users.password_hash`, cria a identidade no provedor e apaga a
coluna.

## Web pública

Next.js em `web/`, canal complementar de aquisição orgânica conforme o
[ADR-0001](docs/adr/0001-web-primeiro.md): landing page, calculadora sem
cadastro e oito páginas por intenção de busca, todas estáticas.

```powershell
cd web
npm run dev
```

Copie `web/.env.example` para `web/.env.local` e defina `NEXT_PUBLIC_SITE_URL`
antes de publicar — sem ela, as canônicas e as imagens de compartilhamento
apontam para `localhost`.

**O motor de precificação é um espelho do da API**, em
`web/src/domain/pricing/calculate-price.ts`. A web calcula localmente para não
depender de servidor no primeiro número, que é justamente o que a página de
aquisição precisa entregar. Enquanto não existir um pacote publicado, a cópia é
a forma de cumprir o ADR-0001 — e para que ela não divirja em silêncio,
`web/tests/pricing-parity.test.ts` compara os dois arquivos caractere a
caractere e roda as duas implementações sobre a mesma matriz de entradas.
`npm run sync:pricing` recopia da API.

Ao mexer no motor: altere o da API, rode `sync:pricing` e rode os testes dos
dois lados. Duas fórmulas de dinheiro divergindo em silêncio é o pior resultado
possível — o teste existe para que isso falhe alto.

## Banco de dados

PostgreSQL com Prisma, conforme o ADR-0002. O schema vive em
`backend/prisma/schema.prisma` e reproduz o modelo do
[documento 04](docs/04-arquitetura-e-dados.md): `users`, `businesses`,
`business_settings`, `materials`, `fixed_costs`, `services`,
`service_materials`, `pricing_calculations`, `equipment`, `subscriptions` e
`billing_events`, mais `sessions`, que a autenticação acrescentou.

Copie `backend/.env.example` para `backend/.env` e preencha `DATABASE_URL`. A
conexão externa do Render exige `?sslmode=require` no final da URL.

```powershell
npm --prefix backend run db:migrate   # cria e aplica migração em desenvolvimento
npm --prefix backend run db:deploy    # aplica migrações pendentes em produção
npm --prefix backend run db:status    # mostra o que falta aplicar
npm --prefix backend run db:studio    # abre o Prisma Studio
```

`GET /health` responde sem tocar no banco; `GET /health/db` confirma que a
conexão está de pé e devolve 503 quando não está.

O banco gratuito do Render não concede a permissão que `prisma migrate dev`
usa para conferir desvio de schema, e o comando falha com *permission denied to
terminate process*. Contra ele, escreva o `migration.sql` na pasta da migração
e aplique com `db:deploy`, que não precisa de banco sombra.

## Escopo da primeira versão

O MVP mobile terá:

- calculadora de entrada sem cadastro;
- cadastro e autenticação;
- perfil do negócio;
- materiais e custos fixos;
- configuração da hora de trabalho;
- serviços e composição de materiais;
- preço recomendado, análise do preço atual e simulador;
- histórico básico conforme o plano;
- assinatura e aplicação dos limites Gratuito, Premium e Master.

Uma calculadora pública indexável, landing pages e conteúdo SEO ficam no pacote
`web/`, como canal complementar. Clientes, agenda, financeiro completo, estoque
e IA estão documentados como evoluções e não fazem parte do primeiro lançamento.

## Nome e posicionamento

**Nome:** BeautyConta, decidido em 2026-09-08  
**Descritor:** Precificação e gestão para profissionais da beleza  
**Frase principal:** Saiba quanto cobrar sem trabalhar no prejuízo.  
**Alternativa curta:** Seu talento tem preço. A BeautyConta faz a conta.

O nome permite começar com unhas sem limitar a expansão para cílios, cabelo,
sobrancelhas e estética, e suporta submarcas por módulo. A decisão está
registrada na seção 7 do [documento de produto](docs/01-produto-e-planos.md).
