# Registros de decisão de arquitetura

A seção 8 do documento 04 lista as decisões que precisam estar registradas antes
da implementação. Cada uma tem um ADR curto nesta pasta.

Formato: contexto, decisão, alternativas consideradas, consequências.

Estados possíveis:

- **Proposto:** recomendação redigida, aguardando aprovação;
- **Aceito:** decisão vigente;
- **Substituído:** trocado por outro ADR, que deve ser citado;
- **Revogado:** abandonado sem substituto.

| ADR | Assunto | Estado |
|---|---|---|
| [0001](0001-web-primeiro.md) | App mobile Expo como produto principal | Aceito em 2026-09-09 |
| [0002](0002-orm.md) | ORM: Prisma | Aceito em 2026-09-08 |
| [0003](0003-autenticacao.md) | Provedor de autenticação | Substituído pelo 0009 |
| [0004](0004-pagamentos.md) | Pagamentos: Mercado Pago e RevenueCat | Aceito em 2026-09-08 |
| [0005](0005-hospedagem.md) | Hospedagem e região dos dados | Proposto |
| [0006](0006-analytics.md) | Analytics com privacidade | Proposto |
| [0007](0007-trial-e-reembolso.md) | Teste grátis, plano anual e reembolso | Proposto |
| [0008](0008-arquitetura-de-codigo.md) | Clean Architecture na API e no projeto | Aceito em 2026-09-08 |
| [0009](0009-autenticacao-propria.md) | Autenticação por e-mail e senha no próprio banco | Aceito em 2026-09-09 |
| [0010](0010-taxas-e-perdas-no-plano-gratuito.md) | Taxas, perdas e outros custos diretos no plano gratuito | Aceito em 2026-09-09 |

Nenhum ADR pode ser marcado como aceito sem data e responsável. Enquanto houver
ADR proposto, o item "decisões técnicas registradas" do checklist do documento
05 permanece em aberto. Faltam os ADRs 0005, 0006 e 0007.

Dois ADRs registram decisões já em produção que foram tomadas fora da ordem
prevista aqui, e continuam em aberto pelo que deixaram pendente:

- o **0009** decidiu o contrário do 0003 para destravar o item D-01. A escolha
  do provedor gerenciado volta à mesa quando o 0005 for aceito, e até lá faltam
  recuperação de senha, verificação de e-mail e limite de tentativas de
  entrada;
- o **0010** resolveu uma contradição entre o documento 01 e o backlog durante
  a construção da API. Foi a única decisão desta pasta que não passou pelo
  proprietário do produto: se ele discordar, o ADR descreve o custo de
  reverter.
