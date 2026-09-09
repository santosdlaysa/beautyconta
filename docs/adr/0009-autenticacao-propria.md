# ADR-0009 — Autenticação por e-mail e senha no próprio banco

**Estado:** Aceito
**Data:** 2026-09-09
**Responsável:** Proprietário do produto

Substitui o [ADR-0003](0003-autenticacao.md).

## Contexto

O ADR-0003 recomendou delegar credenciais a um provedor gerenciado, com a
escolha feita pelo fluxo do Vercel Marketplace no momento em que a hospedagem
do ADR-0005 estivesse definida. O ADR-0005 continua proposto. Enquanto essas
duas decisões não fechavam, o item D-01 do backlog — cadastro, entrada, sessão
persistente, encerramento de sessão e exclusão de conta — permanecia bloqueado,
e com ele a etapa D inteira.

Sem identidade, o aplicativo tinha apenas a calculadora pública. O que separava
uma usuária da outra era o cabeçalho provisório `x-user-id`, aceito sem prova
nenhuma: qualquer chamada podia se declarar dona de qualquer conta. Manter esse
arranjo enquanto se espera uma decisão de hospedagem é pior do que qualquer uma
das opções de autenticação em discussão.

A dona do produto decidiu destravar o aplicativo em vez de esperar. Este ADR
registra a decisão que ela tomou, contra a recomendação do ADR-0003, e o preço
que ela tem.

## Decisão

Guardar e conferir a senha no próprio backend, com sessão persistente também
própria, até que o provedor gerenciado seja escolhido.

O que existe hoje:

- `backend/src/domain/auth/password.ts`: derivação com **scrypt**, sal
  aleatório por senha, parâmetros de custo gravados junto do hash — para poder
  endurecê-los depois sem invalidar as senhas já cadastradas — e comparação em
  tempo constante. Sem dependência nova: `scrypt` vem do próprio Node;
- `backend/src/domain/auth/session-token.ts`: token aleatório de 32 bytes,
  entregue em claro apenas uma vez. O banco guarda somente o resumo SHA-256, de
  modo que o vazamento da tabela `sessions` não devolve nenhuma sessão
  utilizável. A validade é de trinta dias;
- `backend/src/application/use-cases/accounts.ts` e `sessions.ts`: cadastro,
  entrada, troca de senha, resolução do token a cada requisição, saída e
  exclusão de conta com remoção efetiva;
- `backend/prisma/schema.prisma`: coluna `users.password_hash`, opcional porque
  conta criada antes da migração não tem senha, e tabela `sessions` com resumo
  do token, expiração e último uso, em cascata com a conta.

As rotas: `POST /api/users`, `POST /api/sessions`, `DELETE
/api/sessions/current` e `PATCH /api/users/me/password`. O cabeçalho
`x-user-id` deixou de existir.

Três escolhas menores que acompanham a decisão, porque mudá-las depois é mais
caro do que registrá-las agora:

- a entrada devolve a mesma negativa para e-mail inexistente, senha errada e
  conta excluída, e confere a senha contra um hash descartável quando não há
  conta, para que o tempo de resposta não denuncie quem tem cadastro;
- a troca de senha exige a senha atual mesmo com sessão válida, e encerra as
  demais sessões;
- a sessão vencida ou ausente não é erro nas rotas públicas: a calculadora
  continua respondendo sem cadastro.

O provedor gerenciado continua sendo o destino. Esta decisão é uma etapa, não a
posição final do produto.

## Alternativas consideradas

- **Esperar o ADR-0005 e escolher o provedor, como manda o ADR-0003:** é a
  ordem correta, e foi a recomendação. Descartada porque o custo de esperar
  passou a ser concreto — a etapa D parada e o `x-user-id` em pé — enquanto o
  custo de decidir a hospedagem sob pressão da autenticação seria uma escolha
  difícil de desfazer feita pelo motivo errado.
- **Escolher o provedor agora, antes da hospedagem:** possível, mas amarraria a
  hospedagem à autenticação em vez do contrário, e o critério de migração de
  usuários do ADR-0003 exige avaliar os candidatos com calma.
- **Manter o `x-user-id` e adiar tudo:** custo zero de implementação e nenhuma
  segurança. Não é uma opção depois que existe conta com dado financeiro.
- **Biblioteca de autenticação pronta no próprio backend:** acrescentaria
  dependência e configuração sem retirar do projeto nenhuma das
  responsabilidades listadas abaixo, que são o verdadeiro custo desta decisão.

## Consequências

O que se ganhou:

- a etapa D saiu do bloqueio e o aplicativo tem identidade real;
- o `x-user-id` foi eliminado, o que era uma falha aberta enquanto durou;
- nenhuma dependência nova entrou no projeto por causa disso.

O que se perdeu — e é o motivo pelo qual o ADR-0003 recomendava o contrário:

- o projeto assumiu a responsabilidade por **hashing**, incluindo revisar os
  parâmetros de custo do scrypt com o tempo;
- assumiu a responsabilidade por **sessões**: expiração, encerramento em todos
  os aparelhos e limpeza das linhas vencidas em `sessions`;
- assumiu a responsabilidade por **força bruta**. Não há hoje nenhum limite de
  tentativas de entrada, nem por conta nem por origem. Isso é uma lacuna
  conhecida, não um item resolvido;
- assumiu a responsabilidade por **recuperação de senha**, que é justamente o
  que não foi entregue.

O que continua faltando de `RF-01`:

- **recuperação de senha**: quem esquece a senha hoje não tem como voltar à
  conta pelo próprio aplicativo;
- **verificação de e-mail**: a coluna `users.email_verified_at` existe e é
  devolvida pela API, mas nada a preenche;
- ambos dependem de um serviço de envio de e-mail que não foi contratado.
  Enquanto isso não existir, `RF-01` está entregue pela metade, e o item D-01
  do backlog permanece parcial.

Caminho de migração, quando o provedor for escolhido:

1. ler `users.password_hash` e criar a identidade correspondente no provedor —
   quem não puder ser migrado com a senha atual entra pelo fluxo de definição
   de senha do próprio provedor;
2. mover a sessão para o mecanismo do provedor e descartar a tabela
   `sessions`;
3. apagar a coluna `users.password_hash`, restabelecendo a consequência do
   ADR-0003 de que `users` não guarda senha.

Como o hashing e a sessão estão isolados no domínio e os casos de uso só
conhecem o hash, a troca altera infraestrutura e casos de uso de conta, não o
restante da aplicação — é o que o ADR-0008 previa.

Revisar esta decisão deixa de ser opcional quando o ADR-0005 for aceito. Até
lá, o limite de tentativas de entrada e o serviço de e-mail são as duas dívidas
que este ADR deixa registradas.
