# Requisitos e jornadas

## 1. Perfis e permissões

### Visitante

- usa a calculadora pública;
- simula preço e margem;
- visualiza explicação do resultado;
- pode criar uma conta para salvar o cálculo.

### Usuário autenticado

- possui um perfil de negócio;
- acessa os recursos e limites de seu plano;
- gerencia somente os próprios dados;
- pode solicitar exportação ou exclusão da conta.

### Administrador

- gerencia catálogo de categorias e modelos sugeridos;
- visualiza métricas agregadas;
- gerencia planos e assinaturas;
- não deve acessar dados sensíveis sem necessidade e registro de auditoria.

## 2. Jornada pública: calcular sem cadastro

1. Usuária escolhe a categoria e o tipo de serviço.
2. Informa custo total de materiais ou detalha itens, conforme a experiência.
3. Informa duração do atendimento.
4. Informa remuneração desejada por hora.
5. Informa custos fixos mensais e capacidade produtiva.
6. Informa taxas variáveis e margem desejada, se aplicável.
7. Recebe custo total, preço mínimo, preço recomendado, lucro e margem.
8. Pode simular outro preço.
9. É convidada a criar conta para salvar o serviço e montar sua tabela.

Os dados do visitante podem permanecer apenas no dispositivo durante a sessão.
Não devem ser associados a uma identidade sem consentimento.

## 3. Onboarding autenticado

### Etapa 1 — Atuação

- segmento principal;
- outras categorias atendidas;
- nome do negócio, opcional.

### Etapa 2 — Modelo de trabalho

- em casa;
- salão próprio;
- espaço alugado ou compartilhado;
- atendimento domiciliar;
- outro.

### Etapa 3 — Capacidade

- dias trabalhados por mês;
- horas disponíveis por dia;
- horas produtivas por dia ou atendimentos por mês.

### Etapa 4 — Objetivo

- retirada mensal desejada;
- meta de lucro opcional;
- preferência entre informar valor/hora diretamente ou calculá-lo.

### Etapa 5 — Primeiro resultado

O onboarding termina com um serviço calculado. Etapas não essenciais devem poder
ser puladas e completadas depois.

## 4. Requisitos funcionais do MVP

### RF-01 — Autenticação

- cadastro por e-mail e senha;
- login e logout;
- recuperação de senha;
- verificação de e-mail;
- aceite versionado dos termos e da política de privacidade.

### RF-02 — Perfil do negócio

- cadastrar nome, categoria, modelo de trabalho e moeda;
- configurar meta, capacidade produtiva e preferência de arredondamento;
- editar informações a qualquer momento.

### RF-03 — Materiais

- criar, editar, arquivar e listar materiais;
- informar preço e quantidade comprada;
- informar unidade: unidade, ml, g, kg, par, caixa, metro ou personalizada,
  conforme a tabela de normalização do documento 06;
- calcular custo unitário normalizado;
- permitir percentual opcional de perda;
- registrar data da compra, opcional;
- impedir quantidade de compra igual ou inferior a zero.

### RF-04 — Custos fixos

- criar, editar, arquivar e listar despesas mensais;
- aceitar categorias sugeridas do documento 06 e categoria personalizada;
- somar custos ativos do mês;
- manter no Gratuito a alternativa de informar apenas um total mensal.

### RF-05 — Hora de trabalho

- aceitar valor/hora informado diretamente; ou
- calcular a partir de retirada desejada e horas produtivas mensais;
- explicar que horas disponíveis não são necessariamente horas faturáveis.

### RF-06 — Serviços

- criar, editar, duplicar, arquivar e listar serviços;
- informar categoria, nome, duração e margem desejada;
- associar materiais e respectivas quantidades utilizadas;
- informar preço atualmente cobrado, opcional;
- respeitar limites do plano.

### RF-07 — Precificação

- calcular materiais, mão de obra, rateio fixo e custos variáveis;
- diferenciar preço mínimo e recomendado;
- permitir margem entre 0% e 95%;
- explicar composição e fórmula;
- salvar uma fotografia dos dados usados no cálculo.

### RF-08 — Resultado

- mostrar custo total, preço mínimo, preço recomendado e lucro estimado;
- comparar com o preço atual;
- alertar quando o preço atual estiver abaixo do custo ou da margem desejada;
- permitir copiar ou compartilhar um resumo textual;
- permitir arredondar a sugestão para cima conforme configuração.

### RF-09 — Simulador

- aceitar um preço hipotético;
- recalcular lucro em reais e margem percentual;
- não alterar o serviço salvo sem confirmação.

### RF-10 — Histórico

- registrar data, entradas principais e resultado;
- abrir detalhes de um cálculo anterior;
- respeitar o limite de retenção/visualização do plano;
- não recalcular automaticamente um registro histórico com valores atuais.

### RF-11 — Planos

- aplicar os limites do plano gratuito definidos na seção 6 do documento 01:
  10 materiais, 3 serviços, 5 custos fixos e 5 cálculos no histórico;
- mostrar consumo e limites atuais;
- bloquear somente a criação além do limite, preservando leitura dos dados;
- permitir upgrade e cancelamento;
- manter acesso até o final do período pago após cancelamento;
- ao voltar ao Gratuito, preservar dados excedentes como somente leitura.

### RF-12 — Privacidade

- exportar dados da conta em formato legível;
- solicitar exclusão da conta;
- registrar consentimentos e eventos administrativos relevantes.

## 5. Estados importantes da interface

Toda tela com dados remotos deve prever:

- carregando;
- vazia, com orientação para a primeira ação;
- erro recuperável, com tentativa novamente;
- sem conexão;
- limite do plano atingido;
- sucesso com confirmação não intrusiva.

## 6. Requisitos não funcionais

- interface responsiva a partir de 320 px;
- acessibilidade compatível com WCAG 2.2 nível AA como meta;
- valores monetários armazenados como inteiros na menor unidade da moeda;
- datas persistidas em UTC e apresentadas no fuso da usuária;
- cálculo determinístico, testado e versionado;
- p95 das operações comuns abaixo de 500 ms, desconsiderando a rede;
- trilha de auditoria para alteração de plano e ações administrativas;
- backups, restauração testada e monitoramento de erros;
- segredos apenas no ambiente do servidor;
- nenhum dado de uma conta acessível por outra conta.

## 7. Critérios de aceite centrais

### Primeiro cálculo

Dado que uma visitante informou entradas válidas, quando solicitar o cálculo,
então deve receber resultado completo sem criar conta.

### Margem correta

Dado custo de R$ 120 e margem sobre venda de 30%, quando calcular, então o preço
antes de taxas sobre venda deve ser R$ 171,43, sujeito à regra de arredondamento.

### Limite gratuito

Dado que uma usuária gratuita possui 3 serviços ativos, quando tentar criar o
quarto, então deve ver o benefício do upgrade, sem perder acesso aos três já
cadastrados.

### Histórico imutável

Dado um cálculo salvo, quando o preço de um material mudar, então o cálculo
antigo deve continuar exibindo os valores registrados na época.

## 8. Navegação proposta para o MVP

- Início
- Calcular
- Serviços
- Custos
  - Materiais
  - Custos fixos
  - Hora de trabalho
- Histórico
- Perfil e plano

