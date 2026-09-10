# Agenda pública

## 1. Objetivo

A profissional manda um link para a cliente pelo WhatsApp ou pelo Instagram, e
a cliente escolhe serviço, dia e horário sozinha — sem instalar o aplicativo e
sem criar conta.

Construída em 2026-09-09. **Não estava no backlog do MVP**: entrou por pedido
direto da dona do produto, e a decisão de mantê-la no primeiro lançamento
continua aberta, junto com a da agenda interna que a precede.

## 2. O endereço é público

```text
beautyconta.com.br/agendar/studio-marina
```

O apelido sai do nome do negócio quando a agenda é ligada, e a profissional
pode trocá-lo depois. Dois estúdios com o mesmo nome recebem sufixo numérico:
`studio-marina`, `studio-marina-2`.

**O endereço é adivinhável, e isso foi escolhido sabendo do custo.** A
alternativa considerada era um código aleatório, secreto, que ninguém acha sem
receber o link. Optou-se pelo apelido porque ele é bonito de falar, fácil de
digitar e de reconhecer numa conversa.

A consequência é que **a agenda não se defende pelo sigilo do endereço**. As
defesas são outras:

- teto de cinco agendamentos por quinze minutos, por endereço de rede;
- antecedência mínima de trinta minutos;
- horizonte de sessenta dias para frente;
- a página devolve o mínimo: nome, serviços, preço e duração — nada de custo,
  margem ou identificador interno.

Somada à decisão de que **o horário fica marcado sem confirmação**, isso
significa que quem acertar o endereço ocupa a agenda. Mudar para "a confirmar" é
alteração pequena: `appointments.status` já distingue `SCHEDULED` de
`CONFIRMED`, e o aplicativo já mostra os dois.

## 3. Como os horários são calculados

O expediente é cadastrado por dia da semana, em minutos desde a meia-noite, e um
dia pode ter mais de uma faixa — manhã e tarde, com almoço no meio, que é o caso
normal.

Um horário só é oferecido quando o atendimento **inteiro** cabe: dentro de uma
faixa do expediente e sem encostar no que já está marcado. Cancelado e falta não
ocupam horário; a vaga volta a valer.

O passo entre horários é de quinze minutos.

### Fuso

É o primeiro ponto do produto em que o fuso importa de verdade: a cliente
escolhe "quinta, 14:00" olhando o relógio dela, o banco guarda um instante em
UTC, e o servidor pode estar em qualquer lugar. Errar aqui não gera erro — gera
atendimento marcado três horas fora, descoberto quando alguém não é atendida.

A conversão usa o fuso do negócio e a regra vigente **na data marcada**, não na
data de hoje, para atravessar viradas de horário de verão.

### Duas clientes no mesmo horário

A lista de horários é montada antes, e o agendamento chega depois. No meio,
outra pessoa pode ter pegado o mesmo horário.

Por isso a conferência acontece duas vezes: uma para responder com clareza, e
outra **dentro da transação que grava**, com a linha do negócio bloqueada. A
segunda cliente recebe `409` e o pedido de escolher outro horário.

## 4. Rotas

Abertas, para quem só tem o link:

| Método | Rota | O que faz |
|---|---|---|
| `GET` | `/api/booking/:slug` | Nome do negócio e serviços com preço e duração |
| `GET` | `/api/booking/:slug/slots` | Horários livres do dia, para o serviço escolhido |
| `POST` | `/api/booking/:slug/appointments` | Marca o atendimento |

Da profissional, com sessão, sob `/api/businesses/:businessId`:

| Método | Rota | O que faz |
|---|---|---|
| `GET PUT` | `/hours` | Expediente da semana; a gravação substitui tudo |
| `POST` | `/booking-link` | Liga a agenda; sem `slug`, deriva do nome |
| `PUT` | `/booking-link` | Troca o endereço; o anterior morre na hora |
| `DELETE` | `/booking-link` | Desliga a agenda |

Endereço desconhecido e agenda desligada devolvem **a mesma resposta**. Distinguir
os dois transformaria o endereço em sonda.

## 5. O que a cliente não vê

Serviço sem preço não aparece na página: ela não pode escolher às cegas o que
vai pagar. Serviço arquivado também não.

A confirmação devolve só o que é dela — o que marcou, quando e com quem. O
restante do atendimento é dado do negócio.

## 6. O que falta

- **Nenhum evento de telemetria é emitido.** Os doze nomes do catálogo da seção
  8 do documento 05 descrevem calculadora, cadastro e assinatura; nenhum serve
  para agendar, ligar link ou salvar expediente. Ampliar o catálogo depende do
  ADR-0006.
- **Nenhuma tela foi vista por olho humano** — nem a página pública, nem as do
  aplicativo. A verificação foi por teste, construção e HTML servido.
- **A cliente não recebe confirmação.** Não há e-mail nem mensagem: ela vê a
  tela e mais nada. Depende do serviço de e-mail que também trava a recuperação
  de senha.
- **A profissional não é avisada** quando alguém marca. Ela descobre ao abrir o
  aplicativo. Mesmo bloqueio.
- **Sem cancelamento pela cliente.** Quem marcou errado precisa falar com a
  profissional.
- **O teto de requisição conta por endereço de rede.** Clientes no mesmo Wi-Fi
  de um salão, ou atrás do CGNAT de uma operadora, dividem a cota.
