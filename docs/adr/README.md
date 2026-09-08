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
| [0001](0001-web-primeiro.md) | Web responsiva/PWA antes de app nativo | Proposto, revisto pelo 0004 |
| [0002](0002-orm.md) | ORM: Prisma | Aceito em 2026-09-08 |
| [0003](0003-autenticacao.md) | Provedor de autenticação | Proposto |
| [0004](0004-pagamentos.md) | Pagamentos: Mercado Pago e RevenueCat | Aceito em 2026-09-08 |
| [0005](0005-hospedagem.md) | Hospedagem e região dos dados | Proposto |
| [0006](0006-analytics.md) | Analytics com privacidade | Proposto |
| [0007](0007-trial-e-reembolso.md) | Teste grátis, plano anual e reembolso | Proposto |
| [0008](0008-arquitetura-de-codigo.md) | Clean Architecture na API e no projeto | Aceito em 2026-09-08 |

Nenhum ADR pode ser marcado como aceito sem data e responsável. Enquanto houver
ADR proposto, o item "decisões técnicas registradas" do checklist do documento
05 permanece em aberto. Faltam os ADRs 0001, 0003, 0005, 0006 e 0007.
