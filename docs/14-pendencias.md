# O que falta

Estado em 2026-09-09. Este documento existe porque as pendências do projeto
estão espalhadas: umas no backlog, outras em ADR proposto, outras só na cabeça
de quem escreveu o código. Aqui elas ficam juntas, **agrupadas por quem consegue
destravá-las** — que é a informação que decide o que fazer amanhã.

O [backlog](09-backlog-do-mvp.md) continua sendo a lista de trabalho com
critérios de aceite. Este documento é o mapa do que está parado e por quê.

## 1. Depende de decisão da dona do produto

### Três ADRs propostos

| ADR | O que trava |
|---|---|
| [0005 — hospedagem](adr/0005-hospedagem.md) | Publicar, domínio, receber webhook, backup, metade do item G-02 |
| [0006 — analytics](adr/0006-analytics.md) | Para onde os eventos vão. **A camada de emissão já existe** na web e no aplicativo, sem SDK; falta escolher a ferramenta |
| [0007 — periodicidade e reembolso](adr/0007-trial-e-reembolso.md) | O checkout, junto com o 0005 |

### Decisões de produto em aberto

- **Ratificar ou reverter o [ADR-0010](adr/0010-taxas-e-perdas-no-plano-gratuito.md).**
  Taxas, perdas e outros custos diretos foram liberados no plano gratuito, e a
  decisão saiu da implementação, não da dona do produto. O responsável do ADR
  registra isso.
- **Agenda pública: manter "já fica marcado"?** O endereço é adivinhável e o
  horário é reservado sem confirmação. Ver a seção 2 do
  [documento 13](13-agenda-publica.md).
- **Escopo: agenda e agenda pública ficam no MVP?** A seção 10 do backlog coloca
  agenda, clientes, financeiro e estoque nas fases 3 e 4. As duas foram
  construídas mesmo assim, a pedido.
- **A tela de Clientes mostra dados que não existem.** É a única fachada que
  restou no aplicativo: uma lista fixa com nomes inventados, com aviso de
  demonstração. Não há tabela de clientes no banco nem no modelo do documento
  04. Ou entra de verdade, ou sai.
- **O domínio.** `beautyconta.com.br` aparece como padrão no código e nos
  arquivos de exemplo, mas continua tarefa operacional em aberto na seção 7 do
  [documento 01](01-produto-e-planos.md). Sem ele, o link que a profissional
  manda para a cliente não leva a lugar nenhum.

## 2. Depende de terceiro

- **Serviço de e-mail.** Sem ele: recuperação de senha, verificação de e-mail
  (`users.email_verified_at` é lido e nunca preenchido), confirmação para a
  cliente que agendou e aviso para a profissional. Deixa o item D-01 parcial
  para sempre.
- **Credenciais do Mercado Pago e do RevenueCat.** Itens F-02 e F-03. O que não
  depende delas está pronto e testado: idempotência do webhook, verificação de
  assinatura, recusa de compra de ambiente de teste, canal duplicado e
  `subscriptions` como fonte de verdade.
- **Permissão do navegador para `localhost`.** **Nenhuma tela construída hoje
  foi vista por olho humano** — nem no aplicativo, nem na web. Testes,
  construção e HTML servido não pegam texto cortado, contraste que passa no
  cálculo e some na tela, ou fluxo que compila e não faz sentido para quem usa.

## 3. Executável hoje

Nada aqui está bloqueado; é trabalho que cabe fazer.

### Curto

Tudo o que estava aqui foi feito em 2026-09-10: a `AgendaScreen` morta saiu, o
botão de exportar dados existe em **Perfil › Seus dados**, e os dois campos do
onboarding têm coluna, rota e envio pelo aplicativo.

### Médio

- **Item G-02, operação**: ambientes separados, backup diário, restauração
  ensaiada, registro de erros sem dado pessoal e canal de suporte declarado.
  Parte depende do ADR-0005.
- **Identidade visual**: favicon, logotipo vetorial e imagem de compartilhamento
  da inicial ficaram prontos em 2026-09-10. Restam os **ícones de instalação do
  PWA** e uma **imagem própria da página de agendamento**, que hoje herda a da
  inicial. Ver a seção 7 do [documento 10](10-identidade-visual.md).
- ~~Equipamentos sem tela~~ — **feito em 2026-09-10**, em
  **Perfil › Conta e negócio**. Cadastro simples, **sem cálculo de
  depreciação**, com aviso de que a reserva ainda não entra no rateio: quem
  digita preço e vida útil espera que vire conta, e precisa saber que ainda não
  vira. O documento 07 mantém o cálculo fora do MVP.
- **Cancelamento de assinatura pelo site.** A tela existe e trata os três canais,
  mas o caminho da web só funciona quando houver checkout.

### Rasos por enquanto

Financeiro e Relatórios leem dados reais — serviços, custos e cálculos — mas são
derivados: não há lançamento de receita e despesa próprios, nem comparação entre
períodos. Coerente com as fases 3 e 4 do documento 05.

## 4. Dívidas conhecidas

Registradas para não serem redescobertas como novidade.

- **Autenticação própria contra o ADR-0003.** Ver
  [ADR-0009](adr/0009-autenticacao-propria.md). A entrada tem dois tetos desde
  2026-09-10 — por endereço de rede e por e-mail —, então força bruta
  distribuída contra uma conta específica também esbarra em limite. Continua sem
  recuperação de senha, o que torna o bloqueio mais caro para quem esquece a
  própria senha.
- **Nenhum teste de integração toca o banco.** A suíte roda sobre repositórios
  em memória, de propósito: é rápida e não depende de rede. Em troca, o que só o
  PostgreSQL garante — transação, bloqueio de linha, chave estrangeira,
  isolamento — **não é coberto**. Duas garantias vivem nessa lacuna: o limite de
  plano sob concorrência e a dupla marcação na agenda pública. Ambas foram
  verificadas à mão contra o banco real, uma vez.
- **`web/src/domain/pricing/calculate-price.ts` é cópia** do motor da API,
  protegida por teste de paridade que compara os dois caractere a caractere. Ao
  mexer no motor: altere o da API, rode `npm run sync:pricing` na web e rode os
  testes dos dois lados.
- **A porta 3000 costuma estar ocupada** na máquina de desenvolvimento, e o Next
  assume a 3001. O `CORS_ORIGINS` de exemplo já lista as duas.
