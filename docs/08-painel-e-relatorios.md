# Painel e relatórios

## 1. Objetivo

Definir o que a tela inicial mostra em cada fase do produto, com fórmulas
explícitas para cada indicador, evitando que o painel prometa números que a base
de dados ainda não sustenta.

## 2. Princípio central

Um indicador só entra no painel quando existe um registro que o comprove.

Faturamento, número de clientes e atendimentos realizados dependem dos módulos
de clientes, agenda e financeiro, que não fazem parte do MVP. Exibi-los antes
disso exigiria estimativas apresentadas como fato, o que contraria o princípio
de cálculo transparente do documento 01.

Por isso existem dois painéis distintos, e não um painel com campos vazios.

## 3. Painel do MVP

Baseado apenas em serviços, materiais, custos fixos e cálculos salvos.

| Indicador | Fórmula | Origem |
|---|---|---|
| Serviços cadastrados | contagem de serviços ativos | `services` |
| Custo médio por serviço | média de `total_cost` do último cálculo de cada serviço | `pricing_calculations` |
| Serviço mais rentável | maior margem do último cálculo | `pricing_calculations` |
| Serviços abaixo da margem | serviços com preço atual informado e margem real menor que a desejada | `services` + `pricing_calculations` |
| Custo fixo por hora | `custos_fixos_mensais / horas_produtivas_mes` | `business_settings` |
| Valor da sua hora | valor/hora vigente | `business_settings` |
| Último cálculo | data e nome do serviço | `pricing_calculations` |

O bloco de destaque é "serviços abaixo da margem", porque é o único que gera
ação imediata. Quando a contagem é zero, o texto é de confirmação, não de vazio:
"Todos os seus serviços estão dentro da margem desejada."

Regras:

- nenhum indicador aparece antes do primeiro cálculo salvo;
- antes disso, a tela inicial mostra o próximo passo do onboarding;
- "preço atual" é opcional, então a comparação só considera serviços que o
  informaram, e o painel diz quantos ficaram de fora.

## 4. Painel completo

Disponível quando clientes, agenda e financeiro estiverem em produção, conforme
a Fase 4 do documento 05.

| Indicador | Fórmula |
|---|---|
| Faturamento do mês | soma das entradas registradas no período |
| Custos do mês | soma das saídas registradas no período |
| Lucro do mês | faturamento menos custos |
| Margem do mês | lucro dividido pelo faturamento |
| Atendimentos | contagem de atendimentos concluídos |
| Ticket médio | faturamento dividido por atendimentos |
| Clientes ativos | clientes com atendimento nos últimos 90 dias |
| Retorno | percentual de clientes com mais de um atendimento |
| Serviço mais lucrativo | maior lucro acumulado no período |
| Ocupação | horas atendidas dividido por horas produtivas disponíveis |

Regras:

- período padrão é o mês corrente, com comparação ao mês anterior;
- lucro nunca é apresentado como faturamento, e os dois rótulos jamais aparecem
  sem valor monetário ao lado;
- indicadores de período incompleto são marcados como parciais;
- nenhum indicador projeta o fechamento do mês sem dizer que é projeção.

## 5. Alertas

Ordenados por prioridade. No máximo três por vez.

1. serviço com preço atual abaixo do custo total;
2. serviço com margem real abaixo da desejada;
3. material sem atualização de preço há mais de 90 dias;
4. custos fixos sem revisão há mais de 90 dias;
5. horas produtivas configuradas muito acima da média informada.

Alerta é sempre acompanhado da ação correspondente: recalcular, editar material
ou revisar configuração.

## 6. Disponibilidade por plano

| Bloco | Gratuito | Premium | Master |
|---|---|---|---|
| Painel do MVP | Reduzido, sem histórico | Completo | Completo |
| Alertas | Apenas preço abaixo do custo | Todos | Todos |
| Comparação entre períodos | Não | Não | Sim |
| Financeiro simples | Não | Sim | Sim |
| Painel completo | Não | Não | Sim |
| Exportação | Não | Sim | Sim |

## 7. Relatórios

Fase 4, plano Master:

- rentabilidade por serviço no período;
- evolução do custo de materiais;
- comparação entre preço recomendado e preço praticado;
- distribuição do tempo produtivo por categoria;
- receita por cliente.

Todo relatório exportado carrega o período, a data de geração e a versão do
motor usada nos cálculos.

## 8. Estados vazios

- sem cálculo: mostrar o próximo passo, não um painel zerado;
- sem preço atual informado: ocultar as comparações que dependem dele;
- sem dados do período: informar que não há registros e oferecer o período
  anterior, em vez de exibir zeros.
