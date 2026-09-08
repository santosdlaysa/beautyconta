# Roadmap, validação e métricas

## 1. Objetivo do lançamento

Validar se profissionais de beleza:

1. concluem o cálculo com dados reais;
2. entendem e confiam no resultado;
3. voltam para revisar preços;
4. pagam para salvar, detalhar e acompanhar o negócio.

O objetivo inicial não é lançar uma suíte completa de salão.

## 2. Fase 0 — Descoberta

Antes do desenvolvimento completo:

- entrevistar de 10 a 15 nail designers/manicures;
- observar como calculam preços hoje;
- coletar exemplos reais de compra, consumo, duração e despesas;
- testar os termos “margem”, “lucro”, “retirada” e “hora produtiva”;
- validar disposição de pagamento e preferência mensal/anual;
- criar protótipo navegável e realizar pelo menos 5 testes de usabilidade.

### Perguntas essenciais

- Como você definiu o preço do serviço mais vendido?
- Qual foi a última vez que reajustou preços e por quê?
- Quais custos você costuma esquecer?
- Você sabe quanto sobra em um atendimento?
- O que faria você consultar o app toda semana?
- O que já usa para agenda, clientes e finanças?

Evitar perguntar apenas “você usaria?”. Priorizar relatos e demonstrações de
comportamento atual.

## 3. Fase 1 — Calculadora pública

Entregas:

- landing page;
- calculadora por valores agregados;
- resultado transparente;
- simulador de preço;
- páginas preparadas para conteúdo por categoria;
- eventos de analytics e coleta opcional de feedback.

Critério para avançar: ao menos 50% das pessoas que iniciam com dados válidos
chegam ao resultado, e os testes qualitativos indicam compreensão da composição.

## 4. Fase 2 — MVP com conta

Entregas:

- autenticação e onboarding;
- materiais, custos fixos e hora de trabalho;
- serviços e cálculo detalhado;
- histórico;
- limites do Gratuito;
- checkout do Premium;
- privacidade, suporte, monitoramento e backups.

O Master pode aparecer como lista de espera até possuir valor adicional real.

## 5. Fase 3 — Retenção

Priorizar conforme evidência de uso:

- tabela de preços compartilhável;
- lembrete para revisar preço quando material mudar;
- metas e projeções;
- equipamentos e reserva para reposição, conforme o documento 07;
- cadastro simples de clientes e atendimentos;
- visão de rentabilidade por serviço;
- plano anual.

## 6. Fase 4 — Gestão Master

Possíveis entregas:

- agenda;
- confirmação e lembrete;
- cobrança de sinal;
- controle financeiro;
- estoque por movimentação;
- relatórios e metas avançadas;
- equipe e permissões;
- automações e IA com limites claros.

Cada módulo deve passar por descoberta própria. Não deve ser incluído apenas para
igualar concorrentes.

## 7. Estratégia de aquisição

### SEO e calculadoras específicas

Criar experiências úteis, não páginas duplicadas, para intenções como:

- quanto cobrar por alongamento de unha;
- calculadora de preço de manicure;
- quanto cobrar por unha em gel;
- quanto cobrar por fibra de vidro;
- quanto cobrar por extensão de cílios;
- quanto cobrar por volume brasileiro;
- calculadora de preço para cabeleireiro;
- quanto cobrar por procedimento estético.

Cada página deve conter exemplo próprio, custos comuns, perguntas frequentes e a
calculadora pré-configurada. A expansão depende de pesquisa de palavras-chave e
revisão por profissionais do segmento.

### Mensagem padrão de aquisição

O anúncio e o título da página repetem a busca da profissional, em vez de falar
do produto:

> **Quanto cobrar pelo alongamento de unha?**
> Descubra o preço ideal considerando material, tempo de trabalho, aluguel,
> energia e outros custos. Calcule grátis, sem cadastro.

O caminho pretendido é: busca no Google, calculadora gratuita, resultado
explicado, cadastro para salvar, assinatura quando os limites do plano gratuito
apertarem.

Regras de comunicação, coerentes com a seção 6 do documento 01:

- não prometer aumento de faturamento nem lucro garantido;
- não citar preço praticado por concorrentes como referência;
- não anunciar recurso que ainda não esteja em produção;
- deixar explícito que o resultado depende dos dados informados.

### Outros canais

- conteúdo educativo curto em redes sociais;
- parceria com educadoras e cursos profissionais;
- tabela de preço compartilhável com assinatura discreta da marca;
- programa de indicação somente depois de comprovar retenção.

## 8. Funil e eventos

Eventos mínimos, sem enviar valores financeiros ou dados pessoais para analytics
de terceiros:

- `calculator_viewed`
- `calculation_started`
- `calculation_completed`
- `result_explained_opened`
- `price_simulated`
- `signup_started`
- `signup_completed`
- `first_service_saved`
- `plan_limit_reached`
- `checkout_started`
- `subscription_started`
- `subscription_cancelled`

## 9. Métricas

### Aquisição e ativação

- visitantes qualificados por página;
- início e conclusão da calculadora;
- tempo até o primeiro resultado;
- conversão de resultado para cadastro;
- percentual que salva o primeiro serviço.

### Retenção

- retorno em 7, 30 e 90 dias;
- serviços recalculados após mudança de custo;
- cálculos por negócio ativo;
- uso de tabela, histórico e simulador.

### Receita

- conversão Gratuito → Premium/Master;
- receita recorrente mensal;
- receita média por conta;
- cancelamento e motivo;
- inadimplência e recuperação.

### Qualidade

- erros de cálculo reportados;
- abandono por etapa;
- tempo de resposta;
- falhas de pagamento;
- solicitações de suporte por tema.

## 10. Hipóteses a testar

| Hipótese | Experimento | Sinal positivo |
|---|---|---|
| A dor de precificação é frequente | Entrevistas + calculadora pública | Uso com números reais e retorno |
| Salvar serviços gera cadastro | CTA depois do resultado | Conversão consistente |
| Detalhamento justifica Premium | Teste de oferta | Início de checkout e assinaturas |
| R$ 14,90 é aceitável | Teste de preço sem desconto enganoso | Conversão e baixa objeção |
| Gestão aumenta retenção | Liberar módulos em coortes | Melhora de retenção mensal |

## 11. Riscos e mitigação

### Resultado percebido como alto demais

Mostrar composição, permitir ajustar premissas e explicar diferença entre custo,
retirada e lucro.

### Cadastro trabalhoso

Oferecer modo rápido por valores agregados, modelos por categoria e progresso
salvo.

### Usuária confundir faturamento e lucro

Manter definições junto aos números e exemplos consistentes.

### Plano Master prometer demais

Lançar apenas quando agenda/financeiro entregarem benefício confiável; antes
disso, usar lista de espera.

### Fórmula inadequada para todos os negócios

Permitir métodos explícitos, versionar o motor e validar com profissional de
finanças/contabilidade antes da divulgação ampla.

## 12. Checklist de pronto para desenvolvimento

Situação em 2026-09-08.

- [x] backlog com critérios de aceite — documento 09;
- [x] limites dos planos aprovados — seção 6 do documento 01;
- [x] identidade visual mínima definida — documento 10;
- [x] métricas e eventos definidos — seções 8 e 9 deste documento;
- [x] decisões técnicas registradas — oito ADRs escritos; 0002, 0004 e 0008
  aceitos;
- [ ] fluxos e textos do MVP aprovados — documentados, aguardando aprovação;
- [ ] entrevistas e protótipo concluídos;
- [ ] fórmula revisada por especialista;
- [ ] política de privacidade e termos preparados;
- [ ] suporte e canal de feedback definidos.

### O que cada pendência bloqueia

| Pendência | Bloqueia | Não bloqueia |
|---|---|---|
| Entrevistas e protótipo | Investimento em conteúdo e anúncios | Motor, base de dados e calculadora |
| Fórmula revisada | Divulgação ampla e cobrança | Implementação do motor e testes |
| ADRs 0003, 0005, 0006 e 0007 | Conta, publicação e cobrança | Etapas A, B e C do documento 09 |
| Privacidade e termos | Primeira cobrança e coleta de conta | Calculadora pública sem cadastro |
| Suporte e feedback | Lançamento público | Desenvolvimento interno |

Nenhuma pendência impede o início das etapas A, B e C do backlog. Todas as
demais etapas dependem de pelo menos um item acima.

