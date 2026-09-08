# Backlog do MVP

## 1. Como ler este documento

Cada item traz identificador, requisito de origem e critérios de aceite
verificáveis. Um item só é considerado pronto quando todos os seus critérios
passam e existe teste automatizado para as regras de cálculo envolvidas.

Convenções:

- **RF-xx** remete ao documento 02;
- itens marcados como **bloqueado** dependem de um ADR ainda proposto;
- tamanho é esforço relativo, de P a G, não prazo.

## 2. Ordem de execução

A ordem existe para que nada seja construído duas vezes.

```text
Etapa A  camadas, motor e testes            sem dependência externa
Etapa B  base de dados e catálogos          ADR-0002 aceito
Etapa C  calculadora pública completa       depende de A
Etapa D  autenticação e onboarding          bloqueado pelo ADR-0003
Etapa E  cadastros e cálculo salvo          depende de B e D
Etapa F  planos, limites e cobrança         parcial: ADR-0004 aceito, 0007 aberto
Etapa G  publicação, privacidade e suporte  bloqueado pelos ADR-0005 e 0006
```

As etapas A, B e C podem começar imediatamente. As demais aguardam decisão.

## 3. Etapa A — Motor de precificação

Toda a etapa segue a estrutura de camadas do documento 12: o motor vive em
`src/domain/pricing` e não importa framework, ORM nem HTTP.

### A-00 — Estrutura de camadas e objetos de valor

Origem: ADR-0008 e documento 12. Tamanho: M. **Concluído em 2026-09-08.**

Critérios de aceite:

- [x] pastas `domain`, `application`, `infrastructure` e `presentation` criadas;
- [x] `Money`, `Quantity`, `Percentage` e `Duration` implementados e testados;
- [x] código atual de `lib/pricing.ts` migrado para `src/domain/pricing`;
- [x] página e componentes atuais migrados para `src/app` e `src/presentation`;
- [x] regra de dependência verificada pelo ESLint e falhando quando violada.

O motor migrado ainda é o da versão anterior: `Money` e os demais objetos de
valor entram nele no item A-01.

### A-01 — Completar o motor conforme o documento 03

Origem: documento 03, seções 3 a 7. Tamanho: M.

O motor atual cobre apenas o caminho básico. Faltam termos já especificados.

Critérios de aceite:

- aceitar lista de materiais com preço de compra, quantidade comprada,
  quantidade usada e percentual de perda, e derivar `CM`;
- aceitar outros custos diretos `OD` como valor absoluto;
- oferecer os dois métodos de rateio, por hora produtiva e por atendimento, e
  devolver qual foi usado;
- calcular valor/hora a partir de retirada desejada e horas produtivas quando a
  usuária não informar valor/hora;
- devolver preço mínimo e preço recomendado considerando taxa sobre venda;
- recusar entrada com soma de taxa e margem igual ou maior que 100%, com
  mensagem explicável;
- manter precisão interna e arredondar somente na saída;
- nenhuma operação com ponto flutuante binário em valor monetário.

### A-02 — Validações de faixa

Origem: documento 03, seção 11. Tamanho: P.

Critérios de aceite:

- duração entre 1 e 1440 minutos;
- taxa entre 0% e 99%, margem entre 0% e 95%;
- quantidade comprada e horas produtivas maiores que zero;
- atendimentos mensais inteiro maior que zero;
- cada violação devolve o campo culpado, não um erro genérico;
- limite monetário máximo documentado e protegido contra estouro.

### A-03 — Arredondamento comercial

Origem: documento 03, seção 9. Tamanho: P.

Critérios de aceite:

- estratégias: nenhuma, múltiplo de 1, de 5, de 10 e final noventa;
- arredondamento sempre para cima;
- a saída expõe valor calculado e valor comercial;
- quando forem iguais, a interface mostra apenas um.

### A-04 — Simulador de meta

Origem: documento 03, seção 10. Tamanho: P.

Critérios de aceite:

- calcular o lucro médio necessário por atendimento a partir da meta mensal;
- calcular o preço para meta de um serviço representativo;
- devolver também quantos atendimentos são necessários no preço atual;
- a saída é rotulada como projeção, nunca como garantia.

### A-05 — Versionamento do resultado

Origem: documento 03, seção 12. Tamanho: P.

Critérios de aceite:

- todo resultado carrega `calculation_version`, iniciando em `1`;
- mudança de fórmula incrementa a versão e não altera registros anteriores.

### A-06 — Suíte de testes obrigatória

Origem: documento 03, seção 12. Tamanho: M.

Critérios de aceite: existe teste para cada um dos onze casos listados no
documento 03 — material fracionado e múltiplos materiais, perda, minutos
quebrados, os dois métodos de rateio, margem zero, taxa de pagamento, soma
inválida de taxa e margem, preço atual abaixo do custo, cada estratégia de
arredondamento, valores monetários grandes e imutabilidade do histórico. O
exemplo completo da seção 8 do documento 03 vira teste de regressão.

## 4. Etapa B — Base de dados

### B-01 — Esquema Prisma inicial

Origem: documento 04, seção 3, e ADR-0002. Tamanho: M.

Critérios de aceite:

- todos os modelos do documento 04, incluindo `equipment` e `billing_events`;
- repositórios expostos apenas por trás das portas do documento 12, sem vazar
  modelo do Prisma para as camadas internas;
- dinheiro em `BigInt`, quantidades e percentuais em `Decimal`;
- nenhuma coluna de ponto flutuante participa de cálculo;
- toda tabela de negócio tem `business_id` e índice por ele;
- migração inicial versionada no repositório.

### B-02 — Catálogos como semente

Origem: documento 06. Tamanho: P.

Critérios de aceite:

- semear segmentos, unidades, categorias de material, de custo fixo e de
  serviço com os identificadores do documento 06;
- semente idempotente;
- categoria personalizada da usuária nunca é sobrescrita pela semente.

### B-03 — Isolamento por negócio

Origem: documento 04, seção 4. Tamanho: M.

Critérios de aceite:

- toda consulta filtra pelo negócio autorizado;
- existe teste que tenta ler dado de outro negócio e recebe negativa;
- limite de plano é verificado no servidor, nunca apenas na interface.

## 5. Etapa C — Calculadora pública

### C-01 — Campo de taxa sobre venda

Origem: `RF-07`. Tamanho: P.

A interface fixa a taxa em zero, o que contraria o motor.

Critérios de aceite: campo opcional de taxa, explicando que representa cartão,
Pix ou marketplace; o resultado desconta a taxa também no simulador.

### C-02 — Corrigir o lucro do simulador

Origem: documento 03, seção 7. Tamanho: P.

O simulador calcula lucro como preço menos custo, sem descontar a taxa.

Critérios de aceite: passa a usar preço menos custo menos taxa; com taxa zero, o
resultado permanece idêntico ao atual.

### C-03 — Composição detalhada do resultado

Origem: `RF-08`. Tamanho: P.

Critérios de aceite: exibir materiais, mão de obra, custos fixos, outros custos,
taxa e margem; declarar o método de rateio usado; mostrar o preço mínimo ao lado
do recomendado.

### C-04 — Páginas por categoria

Origem: documento 05, seção 7. Tamanho: M.

Critérios de aceite:

- uma rota por intenção de busca listada, com exemplo próprio, custos comuns,
  perguntas frequentes e calculadora pré-preenchida;
- metadados e imagem de compartilhamento por página;
- nenhuma página promete resultado financeiro nem cita preço de concorrente.

### C-05 — Instrumentação de eventos

Origem: documento 05, seção 8, e ADR-0006. Tamanho: P.

Critérios de aceite: os doze eventos são emitidos; nenhum carrega valor
financeiro, nome, e-mail ou telefone; existe teste que falha se uma propriedade
proibida for enviada. A escolha da ferramenta pode esperar; a camada de emissão
não.

### C-06 — Estados e acessibilidade

Origem: `RF-08` e documento 02, seção 5. Tamanho: P.

Critérios de aceite: estados vazio, carregando, erro e sucesso; navegação por
teclado; rótulo associado a todo campo; contraste mínimo de 4,5 conforme o
documento 10.

## 6. Etapa D — Conta e onboarding

Bloqueado pelo ADR-0003.

### D-01 — Autenticação

Origem: `RF-01`. Tamanho: M. Cadastro, entrada, recuperação de senha, sessão
persistente, encerramento de sessão e exclusão de conta com remoção efetiva.

### D-02 — Onboarding em cinco etapas

Origem: documento 02, seção 3. Tamanho: M. Progresso salvo a cada etapa,
possibilidade de pular e primeiro resultado ao final.

### D-03 — Migração do cálculo anônimo

Origem: documento 02, seção 2. Tamanho: P. O cálculo feito sem cadastro é
transferido para a conta ao concluir o registro, sem redigitação.

## 7. Etapa E — Cadastros e cálculo salvo

### E-01 — Materiais

Origem: `RF-03`. Tamanho: M. Unidade normalizada, perda, data da compra e
arquivamento em vez de exclusão quando houver histórico.

### E-02 — Custos fixos

Origem: `RF-04`. Tamanho: P. Inclui a alternativa de total único no plano
gratuito e o bloqueio da linha de reserva para equipamentos.

### E-03 — Hora de trabalho

Origem: `RF-05`. Tamanho: P. Valor informado ou calculado, com explicação de
horas produtivas.

### E-04 — Serviços com composição

Origem: `RF-06`. Tamanho: M. Associação de materiais e quantidades, duplicação e
preço atual opcional.

### E-05 — Histórico imutável

Origem: `RF-10`. Tamanho: M. O registro guarda fotografia das entradas; editar
um material depois não altera cálculo antigo; existe teste que comprova isso.

## 8. Etapa F — Planos e assinatura

O ADR-0004 já definiu os processadores. Continua dependendo do ADR-0007, que
fixa periodicidade e reembolso, e do ADR-0005, que define onde os webhooks são
recebidos.

### F-01 — Limites do plano gratuito

Origem: `RF-11` e documento 01, seção 6. Tamanho: M.

Critérios de aceite:

- dez materiais, três serviços, cinco custos fixos e cinco cálculos no
  histórico;
- ao atingir um limite, a mensagem explica o que muda ao assinar e não apaga
  nenhum dado já cadastrado;
- o limite é verificado no servidor.

### F-02 — Assinatura pelo Mercado Pago

Origem: `RF-11` e documento 11. Tamanho: G.

Critérios de aceite:

- checkout mensal e anual por `preapproval`, com cartão e Pix Automático;
- webhook idempotente, com o evento bruto salvo em `billing_events` antes do
  processamento;
- `subscriptions` como fonte de verdade do acesso, nunca o processador;
- mudança de plano, mudança de periodicidade e cancelamento pela própria
  assinante;
- degradação para o plano gratuito sem perda de dados;
- testes de renovação, falha de cobrança, carência, cancelamento e estorno.

### F-03 — Assinatura nas lojas com RevenueCat

Origem: documento 11. Tamanho: G. Depende do aplicativo móvel e vem depois do
F-02, conforme a revisão do ADR-0001.

Critérios de aceite:

- produtos configurados no RevenueCat para Google Play e App Store;
- identificador enviado ao RevenueCat é o do negócio, nunca o e-mail;
- webhook do RevenueCat alimenta `subscriptions` e `billing_events`;
- checkout bloqueado quando já existe assinatura ativa em outro canal;
- restauração de compra após reinstalação;
- identificadores anônimos resolvidos por `revenuecat_aliases`, com resposta 200
  quando a conta não for encontrada;
- endpoint de sincronização revalida na API do RevenueCat e só permite elevar o
  plano; rebaixamento apenas por webhook;
- mapa explícito de identificador de produto para plano, testando o nível mais
  alto primeiro;
- a interface informa em qual canal a assinatura é gerenciada e cancelada.

## 9. Etapa G — Publicação

Bloqueado pelos ADR-0005 e 0006.

### G-01 — Privacidade e termos

Origem: `RF-12`. Tamanho: M. Política e termos publicados antes da primeira
cobrança, consentimento registrado, exportação e exclusão funcionando.

### G-02 — Operação

Origem: documento 04, seção 7. Tamanho: M. Ambientes separados, backup diário,
restauração ensaiada, registro de erros sem dado pessoal e canal de suporte
declarado.

## 10. Fora deste backlog

Clientes, agenda, financeiro, estoque, equipamentos, painel completo,
relatórios avançados, lembretes de retorno e recursos de inteligência artificial
pertencem às fases 3 e 4 do documento 05. Eles fazem parte da promessa dos
planos pagos, descrita no documento 01, mas não do primeiro lançamento, e só
podem ser anunciados como disponíveis quando estiverem em produção.
