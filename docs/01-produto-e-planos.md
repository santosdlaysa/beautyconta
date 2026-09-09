# Visão do produto e planos

## 1. Resumo executivo

BeautyConta é uma plataforma mobile-first para profissionais autônomos da
beleza calcularem o custo real e o preço recomendado de seus serviços. A
calculadora gratuita é a porta de entrada. A assinatura transforma cálculos
isolados em uma rotina de gestão do negócio.

O lançamento deve priorizar nail designers e manicures. O modelo de categorias
deve, desde o início, aceitar cílios, cabelo, sobrancelhas, estética, maquiagem,
depilação e categorias personalizadas.

## 2. Problema

Muitas profissionais definem preços observando concorrentes ou somando um valor
arbitrário aos materiais. Com isso, deixam de considerar:

- itens consumidos em pequenas quantidades;
- tempo produtivo e remuneração desejada;
- custos fixos e capacidade real de atendimento;
- taxas de pagamento e outros custos variáveis;
- perdas, retrabalho e margem de segurança;
- diferença entre acréscimo sobre custo e margem sobre venda.

O efeito é trabalhar muito, gerar faturamento e ainda assim ter pouco lucro.

## 3. Proposta de valor

### Promessa principal

**Saiba quanto cobrar pelo seu serviço sem trabalhar no prejuízo.**

### Benefícios

- transformar custos dispersos em um preço explicável;
- mostrar onde o dinheiro de cada atendimento é consumido;
- comparar preço atual, preço mínimo e preço recomendado;
- simular cenários sem alterar o cadastro;
- criar uma tabela de preços sustentável;
- acompanhar a evolução do negócio nos planos pagos.

## 4. Público-alvo

### Público inicial

- nail designers;
- manicures e pedicures;
- profissionais de alongamento de unhas;
- extensionistas de cílios.

### Expansão

- cabeleireiros;
- designers de sobrancelhas;
- esteticistas;
- maquiadores;
- depiladores;
- profissionais autônomos de beleza em geral.

### Persona primária

Profissional autônoma que atende de 20 a 100 clientes por mês, controla parte do
negócio pelo WhatsApp e por anotações, sabe quanto recebe, mas não conhece com
segurança o custo e o lucro por serviço.

## 5. Princípios do produto

1. **Resultado antes do cadastro:** a calculadora pública deve entregar valor
   real sem exigir conta.
2. **Linguagem simples:** usar “o que sobra”, “custo por atendimento” e exemplos
   antes de termos contábeis.
3. **Cálculo transparente:** todo resultado deve exibir fórmula e composição.
4. **Progressão natural:** o plano pago deve economizar trabalho e melhorar a
   gestão, não invalidar a calculadora gratuita.
5. **Mobile-first:** todos os fluxos principais devem funcionar confortavelmente
   em uma tela pequena.
6. **Sem falsa precisão:** resultados são estimativas baseadas nos dados
   informados e devem ser apresentados como apoio à decisão.

## 6. Modelo de negócio

Freemium com assinatura mensal e anual.

### A escada de valor

Cada plano responde a uma frase diferente da profissional. Essa distinção é o
que sustenta a diferença de preço e orienta o que entra em cada plano:

- **Gratuito:** "Estou cobrando certo?"
- **Premium:** "Quero organizar meu negócio."
- **Master:** "Quero administrar e crescer meu negócio."

Um recurso só entra no Premium se ajudar a organizar o que já acontece. Entra no
Master se ajudar a decidir o que fazer a seguir.

### Gratuito — R$ 0

A calculadora nunca fica atrás de pagamento. Ela é o principal mecanismo de
aquisição, conforme a seção 7 do documento 05, e precisa entregar um resultado
completo, não uma demonstração.

Inclui:

- calculadora pública, sem cadastro;
- até 10 materiais;
- até 3 serviços;
- até 5 custos fixos;
- valor da hora de trabalho;
- taxa sobre venda, perda de material e outros custos diretos;
- custo real, margem e preço recomendado;
- últimos 5 cálculos no histórico.

Ao final do resultado, o convite é explícito sobre o que muda ao assinar, sem
esconder o número já calculado.

Taxa, perda e outros custos diretos entrarem no gratuito é uma decisão tomada
em 2026-09-09, durante a construção da API, e não uma descrição do desenho
original: esta seção dizia o contrário do item C-01 do backlog, que exige o
campo de taxa na calculadora pública — gratuita e sem cadastro. O ADR-0010
registra a escolha, o argumento de venda que o Premium perde com ela e o que
custa revertê-la.

### Premium — R$ 14,90 por mês

Para quem quer organizar o negócio.

- precificação sem limite: materiais, serviços, custos fixos e cálculos;
- histórico completo e comparação entre cálculos;
- tabela de preços exportável e compartilhável;
- metas: "quanto preciso trabalhar para ganhar X", devolvendo número de
  atendimentos e preço médio necessário;
- clientes: cadastro, telefone, histórico de atendimentos e valor gasto;
- financeiro simples: receitas, despesas, lucro e fechamento mensal;
- painel do MVP completo, conforme o documento 08.

### Master — R$ 29,90 por mês

Para quem administra o negócio profissionalmente. Tudo do Premium, mais:

- agenda: calendário, horários, serviço, valor e status do atendimento;
- estoque: entrada, saída, saldo, custo médio, consumo por serviço e alerta de
  estoque baixo;
- lembretes de retorno, como manutenção recomendada por cliente;
- relatórios avançados por serviço, com atendimentos, faturamento e lucro;
- comparação entre períodos, com variação de faturamento, custo e lucro;
- assistente de análise, que interpreta preço, margem e meta e responde a
  perguntas como "estou cobrando bem neste serviço?", com créditos mensais.

### Por que agenda e estoque ficam no Master

Colocar clientes, financeiro, agenda e estoque no Premium apagaria a diferença
entre os dois planos pagos e deixaria o Master sem argumento próprio. A divisão
adotada mantém a promessa de cada um legível: o Premium organiza o que já
existe, o Master administra a operação.

### Resumo

| Recurso | Gratuito | Premium | Master |
|---|---|---|---|
| Calculadora pública | Sim | Sim | Sim |
| Materiais | Até 10 | Ilimitados | Ilimitados |
| Serviços | Até 3 | Ilimitados | Ilimitados |
| Custos fixos | Até 5 | Ilimitados | Ilimitados |
| Histórico de cálculos | Últimos 5 | Completo | Completo |
| Taxas, perdas e outros custos | Sim | Sim | Sim |
| Simulador de preço | Sim | Sim | Sim |
| Metas de faturamento | Prévia | Completa | Completa |
| Tabela de preços | Visualização | Exportável | Personalizada |
| Clientes | Não | Sim | Sim |
| Financeiro | Não | Simples | Completo |
| Agenda | Não | Não | Sim |
| Estoque | Não | Não | Sim |
| Lembretes de retorno | Não | Não | Sim |
| Relatórios avançados | Não | Não | Sim |
| Comparação entre períodos | Não | Não | Sim |
| Assistente de análise | Não | Não | Créditos mensais |

### Preços

| Plano | Mensal | Anual |
|---|---:|---:|
| Gratuito | R$ 0 | — |
| Premium | R$ 14,90 | R$ 149,90 |
| Master | R$ 29,90 | R$ 299,90 |

O anual equivale a dois meses de desconto. Conforme o ADR-0007, ele só é
oferecido a partir da Fase 3, quando houver evidência de retenção mensal.

### Regra de comunicação dos planos

Esta regra é a mais importante desta seção, porque o desenho acima descreve o
produto completo, e não o que existe no lançamento.

- recurso futuro nunca é vendido como disponível;
- na interface, aparece como "em breve" até estar em produção;
- o checkout lista somente o que o assinante recebe naquele momento;
- no lançamento do MVP, o Premium é vendido pela precificação sem limite,
  histórico e tabela de preços; clientes e financeiro entram quando forem
  entregues;
- o Master permanece como lista de espera enquanto agenda e estoque não
  existirem, conforme a Fase 2 do documento 05.

### Por que o gratuito é útil

A usuária gratuita consegue concluir um cálculo e entender se está cobrando
corretamente. Os limites aparecem quando ela quer salvar mais serviços, evitar
recadastro, detalhar despesas ou gerir o negócio. Isso cria interesse sem tornar
o plano gratuito uma demonstração vazia.

## 7. Posicionamento e identidade verbal

- Nome: **BeautyConta**
- Categoria: precificação e gestão para profissionais da beleza
- Promessa: **Saiba quanto cobrar sem trabalhar no prejuízo.**
- Tom: acolhedor, direto, competente e sem julgamento
- Evitar: excesso de termos contábeis, promessas de lucro garantido e diminutivos
  que infantilizem a profissional

### Decisão de nome

**BeautyConta é o nome definitivo**, decidido em 2026-09-08. O nome não será
reaberto para discussão; alternativas anteriormente listadas foram descartadas.

O nome comunica beleza e controle financeiro ao mesmo tempo, e não prende o
produto às unhas: a expansão para cílios, cabelo, sobrancelhas e estética não
exige troca de marca. Ele também suporta submarcas por módulo, como BeautyConta
Agenda ou BeautyConta Financeiro, sem perder identidade.

Permanecem como tarefa operacional, sem afetar a decisão: registro de domínio,
reserva dos perfis em redes sociais e busca de anterioridade de marca no INPI.
Caso surja impedimento legal de registro, a resposta será ajustar a forma de
apresentação da marca, não trocar o nome do produto.

## 8. Fora do escopo do MVP

- marketplace de profissionais;
- prontuário ou dados clínicos;
- emissão fiscal;
- conta bancária ou conciliação automática;
- confirmação automática por WhatsApp;
- cobrança de sinal;
- controle de estoque por movimentação;
- agenda multi-profissional;
- inteligência artificial generativa;
- recomendações baseadas em preços de concorrentes.

