# ADR-0005 — Hospedagem e região dos dados

**Estado:** Proposto
**Data:** —
**Responsável:** —

## Contexto

O documento 04 propõe Next.js e PostgreSQL sem definir onde isso roda. A ideia
original citava Docker em VPS. O público está no Brasil e usa o produto pelo
celular, muitas vezes em rede móvel, o que torna a latência perceptível.

A LGPD não exige que dados pessoais fiquem em território nacional. A escolha da
região é, portanto, decisão de desempenho e custo, não de conformidade. O que a
lei exige é base legal, transparência e capacidade de excluir e exportar dados,
tratadas em `RF-12`.

## Decisão

Hospedar a aplicação em plataforma gerenciada com implantação por commit,
ambientes de pré-visualização e retorno automático de versão, em vez de VPS
administrada manualmente.

Banco PostgreSQL gerenciado, com região preferencial em São Paulo quando o
provedor oferecer, e leste dos Estados Unidos como alternativa aceitável. A
região do banco e a da aplicação devem coincidir; banco em São Paulo com
aplicação nos Estados Unidos soma latência a cada consulta.

Requisitos mínimos do banco escolhido:

- backup diário com restauração testada;
- retenção mínima de sete dias;
- conexão por pool compatível com funções serverless;
- possibilidade de exportar o banco inteiro sem intervenção do suporte.

## Alternativas consideradas

- **VPS com Docker:** custo fixo menor e controle total. Exige administrar
  sistema operacional, certificados, backup e monitoramento, trabalho que
  consome o tempo de uma equipe pequena.
- **Banco autogerenciado no mesmo servidor:** mais barato, concentra o maior
  risco do produto em uma máquina sem restauração ensaiada.

## Consequências

- custo por uso, que cresce com a base e precisa ser acompanhado nas métricas;
- dependência de plataforma, mitigada por manter a aplicação em Node padrão, sem
  recurso proprietário no caminho crítico do cálculo;
- a região definida aqui precisa ser declarada na política de privacidade, com
  menção a transferência internacional caso não seja o Brasil;
- restauração de backup ensaiada antes do primeiro assinante pagante, conforme a
  seção 7 do documento 04.
