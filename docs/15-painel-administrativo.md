# Painel administrativo

Estado em 2026-09-10. O painel vive em `/admin`, no mesmo site do BeautyConta,
e foi construído tomando como referência o painel do DocePreço — outro produto
da mesma dona, com cerca de trinta telas em produção.

Este documento existe para responder a uma pergunta específica: **o que aquele
painel tem que este ainda não tem, e quanto custa cada peça.** A resposta não é
uma lista de telas, porque a maior parte do que falta não é tela — é
funcionalidade de produto inteira, com tabela, endpoint e, às vezes, uma tela no
aplicativo também.

O agrupamento abaixo é por **quanto falta construir**, que é a informação que
decide o que fazer amanhã.

---

## 1. O que o painel já faz

Dez telas, todas sobre dados que o BeautyConta já produz.

| Seção | Tela | O que mostra |
|---|---|---|
| — | Resumo | Contas, assinaturas ativas por canal, receita, uso do produto |
| — | Números do negócio | Funil do mês contra o anterior, churn, ticket, cadastros por dia |
| — | Atividade | Cálculos, agendamentos e serviços recentes |
| Cadastro | Usuárias | Lista com busca por nome e e-mail |
| Cadastro | Negócios | Estúdios com segmento, agenda pública e contadores |
| Cadastro | Assinantes | Plano, situação, canal e vigência |
| Configuração | Planos e preços | Edição de preço, benefícios e disponibilidade |
| Configuração | Cobrança | Eventos dos processadores e sinais de falha silenciosa |
| Configuração | Exclusões de conta | Fila de pedidos vindos do site |
| Configuração | Integrações | O que está ligado neste servidor |

Três regras valem para todas e devem continuar valendo no que vier depois:

- **Conta apagada não aparece.** A exclusão do `RF-01` é uma promessa; uma conta
  removida que continuasse listada no painel tornaria a promessa falsa.
- **O plano em vigor sai do domínio**, por `effectivePlan`. Duas respostas para
  "qual plano é este" é o tipo de divergência que faz o painel mentir.
- **Nenhum segredo aparece na tela.** A aba de Integrações diz se cada
  credencial existe, nunca qual é.

---

## 2. Falta só a tela

O endpoint existe e responde. É trabalho de horas.

### 2.1 Detalhe da usuária

`GET /api/admin/users/:id` já devolve a conta com todos os negócios dela, os
contadores de cada um (serviços, materiais, custos, cálculos, agendamentos) e o
histórico de assinaturas. **Não há tela que consuma isso.**

É o buraco mais visível do painel hoje: a lista de usuárias não leva a lugar
nenhum ao clicar.

No DocePreço, a tela equivalente (`UserDataPage`) também permite editar os
cadastros da usuária pelo painel. Isso aqui **não deveria ser copiado** sem uma
decisão explícita: editar o material de alguém pelo painel muda o preço que
aquela pessoa cobra, e ela não fica sabendo.

---

## 3. Falta endpoint, os dados já existem

O banco já guarda o necessário. Falta consulta e tela.

### 3.1 Histórico de uma assinatura

O DocePreço tem `premium-history`: a linha do tempo de uma assinatura, evento a
evento. Aqui os dados estão em `billing_events`, com o payload bruto de cada
webhook gravado — dá para reconstruir a história inteira de uma cobrança.

**Por que vale:** quando alguém reclamar de cobrança, esta tela é a diferença
entre responder em dois minutos e abrir o banco à mão.

### 3.2 Reprocessar um evento de cobrança

A aba de Cobrança já mostra quantos eventos ficaram por processar. Ela **não
permite reprocessar** — e o caso de uso `HandleBillingWebhook` já sabe retomar
um evento gravado e não concluído, porque foi escrito para a reentrega do
provedor.

Falta expor isso como um botão. É a correção de um problema que hoje só se
resolve esperando o provedor reenviar, ou não se resolve.

### 3.3 Conceder plano manualmente

O DocePreço tem `setPremium` e `grantTrial`. Aqui não existe, e a ausência é
deliberada até agora: conceder acesso escrevendo direto em `subscriptions`
criaria um plano que **nenhum webhook consegue explicar depois** — e a próxima
notificação do provedor pode sobrescrevê-lo sem aviso.

Se for feito, precisa de canal próprio (`WEB` com provedor `MANUAL`) e registro
de quem concedeu e por quê. Não é uma linha.

### 3.4 Exportar dados de uma conta pelo painel

`GET /api/businesses/:id/export` já existe e entrega tudo em JSON. Falta o
painel poder acioná-lo — útil para responder a um pedido de portabilidade da
LGPD sem depender de a pessoa conseguir entrar no aplicativo.

---

## 4. Precisa de tabela, endpoint e tela

Aqui deixa de ser "aplicar uma tela" e passa a ser construir uma funcionalidade.
Cada item abaixo é uma tabela nova no banco, um conjunto de endpoints e uma tela
no painel.

| O que | Tabela no DocePreço | Também precisa de tela no app? |
|---|---|---|
| Cupons de desconto | `coupons` | Sim — campo no checkout |
| Banners e avisos na tela inicial | `banners` | Sim |
| Dicas e conteúdo motivacional | `motivational_tips` | Sim |
| Perguntas frequentes | `faq_items` | Sim |
| Novidades da versão | `changelog_entries` | Sim |
| Feedbacks e sugestões | `feedbacks`, `suggestions` | Sim — formulário de envio |
| Indicações entre usuárias | `referrals` | Sim — tela de convite |
| Chave de funcionalidade | `feature_flags` | Não, mas muda o comportamento do app |
| Notificações por push | `notification_templates`, `push_tokens` | Sim — permissão e registro |
| Chat de suporte | `support_messages` | Sim — tela de conversa |
| Passos do onboarding editáveis | `onboarding_steps` | Sim |
| Configuração geral (metas) | `app_settings` | Não |

**A coluna da direita é a parte que costuma ser esquecida.** Um cupom que ninguém
pode digitar não desconta nada; uma dica que não aparece em lugar nenhum é uma
linha no banco. Para a maioria destes itens, o painel é metade do trabalho — e a
metade menor.

### Ordem sugerida, se for para fazer

1. **Configuração geral** (`app_settings`) — a mais barata, e destrava as
   outras: uma tabela chave-valor com meta de cadastro, avisos e chaves de
   funcionalidade cabe num dia.
2. **Cupons** — é a única da lista que afeta receita diretamente. Exige mexer no
   checkout do Mercado Pago e no preço que o servidor calcula.
3. **Feedbacks e sugestões** — barata e informativa: um formulário no app e uma
   lista no painel.
4. O resto, conforme o produto pedir.

---

## 5. Precisa de infraestrutura nova

### 5.1 Registro de requisições HTTP

O DocePreço tem `request_logs` e duas telas sobre ele: rotas mais chamadas e
visão de segurança (tentativas de acesso, origens suspeitas).

Aqui **não há registro persistente de requisição.** Gravar todas em banco tem
custo real de escrita e de espaço, e no Render isso aparece na conta. A
alternativa honesta é ligar um serviço de observabilidade em vez de construir
um — e essa escolha está em aberto no [ADR-0006](adr/0006-analytics.md).

### 5.2 Telegram configurável pelo painel

O aviso por Telegram já funciona: novo cadastro, assinatura, erro de servidor,
pedido de exclusão de conta e relatório diário. O que não existe é **escolher
pelo painel quais avisos disparam** — hoje isso é variável de ambiente, e mudar
exige publicar o servidor.

Uma tabela de preferências resolveria. É pequeno e útil.

### 5.3 Entrar como a usuária

O DocePreço tem `impersonate`. É a ferramenta de suporte mais poderosa que
existe e a mais perigosa: quem a tem lê e escreve como outra pessoa, sem que ela
saiba.

Se um dia entrar, precisa de: consentimento registrado, prazo curto, trilha de
auditoria de tudo o que foi feito, e aviso à titular. Sem isso é acesso
irrestrito a dado alheio com aparência de funcionalidade.

---

## 6. Fora do escopo, por decisão

### Console SQL

O DocePreço tem `POST /admin/db/query`, que executa consulta livre no banco.

**Isto não deve ser trazido.** Uma caixa que roda SQL arbitrário em produção,
protegida por um único segredo, transforma um painel comprometido em um banco
comprometido. O ganho — não abrir um cliente de banco — não paga o risco.

### Fila de aprovação de Pix

Existe lá porque o Pix do DocePreço é manual: QR fixo, comprovante enviado,
aprovação humana. Aqui o Pix é automático pela API do Mercado Pago — o pagamento
aprovado vira acesso pelo webhook, sem ninguém no meio.

Trazer a fila seria criar trabalho manual que não existe.

### Ingredientes, receitas, lojas e pedidos

São o domínio do DocePreço. O equivalente aqui — materiais, serviços,
equipamentos — já aparece nos contadores de cada negócio.

---

## 7. O que este painel tem e o outro não

Vale registrar, porque nasceu de problema real deste produto:

- **Cobrança com sinais de falha silenciosa.** Eventos não processados,
  assinaturas vencidas ainda marcadas como ativas, assinaturas em carência. Cada
  número existe porque o defeito correspondente não aparece em lugar nenhum.
- **Exclusões de conta.** Exigência de Apple e Google, com contagem de dias de
  espera e destaque a partir de quinze — o prazo legal aperta antes de alguém
  descobrir pelo caminho errado.
- **Integrações.** Diz o que está faltando configurar pelo nome da variável, sem
  mostrar nenhuma credencial.

---

## 8. Resumo para decidir

| Grupo | Itens | Esforço | Vale a pena? |
|---|---|---|---|
| Falta só a tela | 1 | Horas | **Sim, é o buraco visível hoje** |
| Falta endpoint | 4 | Dias | Reprocessar evento e histórico de cobrança, sim |
| Feature completa | 12 | Semanas | Depende do produto, não do painel |
| Infra nova | 3 | Semanas | Telegram configurável é barato; o resto não |
| Fora do escopo | 3 | — | Não |

A recomendação, se for para escolher uma coisa: **a tela de detalhe da usuária**.
O endpoint já existe, é a única tela que falta para o painel deixar de ter um
clique morto, e é ela que responde à pergunta que se faz quando alguém escreve
para o suporte.
