# Arquitetura e dados

## 1. Direção técnica

A decisão final deve considerar experiência da equipe e velocidade de validação.
Uma base coerente para o app mobile principal e o canal web complementar é:

- mobile principal: React Native com Expo SDK 57, na pasta `mobile/`;
- web complementar: Next.js com TypeScript, na pasta `web/`, para SEO, landing
  pages e calculadoras públicas;
- API: Node.js/TypeScript, em serviço compartilhado por mobile e web;
- banco: PostgreSQL;
- ORM: Prisma, decidido no ADR-0002;
- organização do código: Clean Architecture, decidida no ADR-0008 e detalhada no
  documento 12;
- autenticação: solução madura com sessões seguras e provedores opcionais;
- pagamentos: Mercado Pago na web e RevenueCat nas lojas, decididos no ADR-0004
  e detalhados no documento 11;
- armazenamento: compatível com S3 apenas quando houver arquivos;
- observabilidade: erros, logs estruturados e métricas sem registrar dados
  pessoais desnecessários.

O app Expo é a superfície prioritária do MVP. A web pode evoluir em paralelo
sem bloquear os fluxos mobile e atende a aquisição orgânica. A lógica de cálculo
deve ficar em um pacote independente para ser reutilizada no mobile, API e web.

## 2. Componentes

```text
App Expo (principal)       Web/SEO (complementar)
             \             /
              v           v
                 API de aplicação ---- Serviço de assinatura
                          |
                          +---- Motor de precificação versionado
                          |
                          v
                    PostgreSQL
```

O motor de cálculo não consulta o banco diretamente: recebe entradas validadas e
retorna um resultado. A camada de aplicação monta as entradas, aplica permissões
e salva a fotografia do cálculo.

## 3. Modelo de dados inicial

### users

- id: UUID
- name
- email normalizado e único
- email_verified_at
- created_at
- updated_at
- deleted_at, opcional

Credenciais podem pertencer ao provedor de autenticação e não precisam ficar na
tabela de domínio.

### businesses

- id: UUID
- owner_user_id
- name, opcional
- primary_category
- work_model
- currency, padrão `BRL`
- timezone, padrão escolhido no onboarding
- created_at
- updated_at

### business_settings

- business_id
- desired_monthly_withdrawal_cents
- productive_hours_per_month
- estimated_appointments_per_month
- fixed_cost_allocation_method: `PRODUCTIVE_HOUR` ou `APPOINTMENT`
- rounding_strategy
- created_at
- updated_at

### materials

- id
- business_id
- name
- category
- purchase_price_cents
- purchase_quantity_decimal
- unit
- waste_percentage_decimal
- purchase_date
- is_archived
- created_at
- updated_at

### fixed_costs

- id
- business_id
- name
- category
- monthly_amount_cents
- is_active
- created_at
- updated_at

### services

- id
- business_id
- name
- category
- duration_minutes
- desired_margin_decimal
- current_price_cents, opcional
- other_direct_cost_cents
- sales_fee_percentage_decimal
- is_archived
- created_at
- updated_at

### service_materials

- service_id
- material_id
- quantity_used_decimal
- chave única composta por serviço e material

### pricing_calculations

- id
- business_id
- service_id, opcional para cálculo avulso
- calculation_version
- input_snapshot: JSON versionado
- material_cost_cents
- labor_cost_cents
- allocated_fixed_cost_cents
- other_direct_cost_cents
- total_base_cost_cents
- minimum_price_cents
- suggested_price_cents
- commercial_price_cents
- expected_profit_cents
- expected_margin_decimal
- created_at

### equipment

Detalhada no documento 07. Fora do MVP; a estrutura fica registrada aqui para
que o modelo nasça completo.

- id
- business_id
- name
- type
- acquisition_price_cents
- residual_value_cents
- useful_life_months
- acquisition_date
- is_archived
- created_at
- updated_at

### subscriptions

Detalhada no documento 11.

- id
- business_id
- plan: `FREE`, `PREMIUM` ou `MASTER`
- status: `active`, `in_grace`, `past_due`, `canceled`, `expired`, `refunded`
  ou `paused`
- channel: `WEB`, `ANDROID` ou `IOS`
- provider: `MERCADO_PAGO` ou `REVENUECAT`
- billing_period: `MONTHLY` ou `ANNUAL`
- provider_customer_id
- provider_subscription_id
- revenuecat_app_user_id
- mp_preapproval_id
- current_period_start
- current_period_end
- cancel_at_period_end
- created_at
- updated_at

### billing_events

Registro bruto dos webhooks, base da idempotência exigida pelo documento 11.

- id
- business_id
- subscription_id
- source: `MERCADO_PAGO` ou `REVENUECAT`
- external_event_id, único
- type
- payload_json
- processed_at
- created_at

### revenuecat_aliases

Mapeia identificadores anônimos do RevenueCat para o negócio. Necessária porque
a compra pode ocorrer antes de a usuária ser identificada; ver seção 12 do
documento 11.

- id
- business_id
- rc_app_user_id, único
- created_at

### consent_records

- id
- user_id
- document_type
- document_version
- accepted_at
- source

### audit_events

- id
- actor_user_id, opcional
- business_id, opcional
- event_type
- metadata sem segredos
- created_at

## 4. Decisões de persistência

- dinheiro é salvo em centavos inteiros, em colunas `BIGINT` mapeadas para
  `BigInt` no Prisma;
- quantidades e percentuais usam decimal exato em colunas `NUMERIC` mapeadas
  para `Decimal`, nunca ponto flutuante binário;
- `BigInt` e `Decimal` são convertidos na borda da API, nunca dentro do motor de
  precificação;
- exclusão de material usado em histórico vira arquivamento;
- histórico salva fotografia das entradas, não apenas referências;
- todas as consultas de negócio são filtradas por `business_id` autorizado;
- uma assinatura pertence ao negócio, preparando futura equipe sem redesenho;
- limites de plano são regras do servidor, nunca apenas da interface.

## 5. API conceitual do MVP

Os caminhos são ilustrativos e podem ser adaptados a Server Actions ou RPC.

```text
POST   /auth/register
POST   /auth/login
POST   /auth/forgot-password

GET    /me
GET    /business
PATCH  /business
PATCH  /business/settings

GET    /materials
POST   /materials
PATCH  /materials/:id
DELETE /materials/:id          # arquiva quando houver referência

GET    /fixed-costs
POST   /fixed-costs
PATCH  /fixed-costs/:id
DELETE /fixed-costs/:id

GET    /services
POST   /services
GET    /services/:id
PATCH  /services/:id
DELETE /services/:id           # arquiva

POST   /pricing/preview        # não persiste; disponível publicamente com limite
POST   /pricing/calculations   # calcula e salva
GET    /pricing/calculations
GET    /pricing/calculations/:id

GET    /billing/subscription
POST   /billing/checkout
POST   /billing/portal
POST   /webhooks/billing

POST   /privacy/export
POST   /privacy/delete-account
```

## 6. Segurança e LGPD

- coletar somente dados necessários;
- política de privacidade clara, com finalidade e retenção;
- TLS em trânsito e criptografia oferecida pela infraestrutura em repouso;
- senhas com algoritmo de hash apropriado quando geridas internamente;
- cookies de sessão `HttpOnly`, `Secure` e com política `SameSite` adequada;
- proteção contra CSRF, XSS, injeção, abuso e tentativas de login;
- rate limit na calculadora pública, autenticação e recuperação de senha;
- webhooks autenticados, idempotentes e tolerantes a reenvio;
- segregação por negócio testada em integração;
- exportação e exclusão com confirmação de identidade;
- prazo de retenção definido para logs, backups e contas excluídas;
- procedimento de incidente e canal para solicitações de titulares.

Dados sobre procedimentos estéticos podem se tornar sensíveis dependendo do que
for registrado. O MVP não deve armazenar prontuários, diagnósticos, fotos clínicas
ou informações de saúde.

## 7. Ambientes e qualidade

- desenvolvimento, homologação e produção isolados;
- migrações versionadas;
- dados de demonstração sem informações pessoais reais;
- testes unitários do motor;
- testes de integração para autorização e limites;
- teste ponta a ponta do primeiro cálculo, cadastro e upgrade;
- análise estática, formatação e build no CI;
- restauração de backup ensaiada antes de operar dados pagos.

## 8. Decisões ainda abertas

Os ADRs estão redigidos em [`docs/adr`](adr/README.md). Os ADRs 0002, 0004 e
0008 foram aceitos; os demais seguem no estado **proposto**.

| ADR | Assunto | Recomendação atual |
|---|---|---|
| [0001](adr/0001-web-primeiro.md) | App Expo principal versus web complementar | Expo primeiro; web para SEO |
| [0002](adr/0002-orm.md) | Prisma versus Drizzle | **Prisma, aceito** |
| [0003](adr/0003-autenticacao.md) | Provedor de autenticação | Provedor gerenciado, a validar |
| [0004](adr/0004-pagamentos.md) | Pagamentos e assinaturas | **Mercado Pago e RevenueCat, aceito** |
| [0008](adr/0008-arquitetura-de-codigo.md) | Organização do código | **Clean Architecture, aceito** |
| [0005](adr/0005-hospedagem.md) | Hospedagem e região | Plataforma gerenciada, região São Paulo |
| [0006](adr/0006-analytics.md) | Analytics com privacidade | Sem dado financeiro ou pessoal |
| [0007](adr/0007-trial-e-reembolso.md) | Teste grátis, anual e reembolso | Sem teste com cartão; reembolso em 7 dias |

O ADR-0003 ainda depende de escolha de provedor, e o ADR-0005 precisa ser
decidido antes da primeira cobrança.
