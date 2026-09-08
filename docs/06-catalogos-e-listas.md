# Catálogos e listas de referência

## 1. Objetivo

Os requisitos definem que materiais, custos fixos e serviços aceitam
"categorias sugeridas e categoria personalizada", sem enumerar quais são. Este
documento fixa essas listas para que a implementação não precise inventá-las e
para que produto, interface e base de dados usem os mesmos identificadores.

Regras gerais:

- cada item possui um `slug` estável em inglês e um rótulo em português;
- o `slug` nunca é renomeado; se um item sair de uso, ele é desativado;
- o rótulo pode ser ajustado sem migração de dados;
- toda lista aceita item personalizado criado pela usuária;
- item personalizado pertence ao negócio e não é promovido ao catálogo global
  sem revisão de produto;
- as listas são semente inicial, não restrição: nenhuma regra do motor de
  precificação depende de categoria.

## 2. Segmentos profissionais

Usados na etapa 1 do onboarding e na segmentação de conteúdo.

| slug | Rótulo | Situação |
|---|---|---|
| `nails` | Unhas | Lançamento |
| `lashes` | Cílios | Lançamento |
| `brows` | Sobrancelhas | Expansão |
| `hair` | Cabelo | Expansão |
| `esthetics` | Estética | Expansão |
| `makeup` | Maquiagem | Expansão |
| `waxing` | Depilação | Expansão |
| `other` | Outro | Sempre disponível |

"Situação" orienta a prioridade de conteúdo e de modelos prontos. Todos os
segmentos podem ser escolhidos desde o primeiro dia; apenas o material de apoio
é priorizado.

## 3. Modelos de local de trabalho

Usados na etapa 2 do onboarding. Influenciam quais custos fixos são sugeridos.

| slug | Rótulo | Custos fixos sugeridos |
|---|---|---|
| `home` | Em casa | Energia, água, internet, rateio parcial |
| `own_salon` | Salão próprio | Aluguel, condomínio, energia, água, internet |
| `rented_station` | Cabine ou espaço alugado | Aluguel da cabine, internet |
| `shared_space` | Espaço compartilhado | Comissão ou taxa do espaço, transporte |
| `mobile` | Atendimento domiciliar | Transporte, telefone, embalagens |

Quem trabalha em casa deve ser orientada a lançar apenas a parcela do custo
atribuível ao trabalho, não a conta inteira da residência.

## 4. Unidades de medida

`RF-03` define o conjunto mínimo. A normalização existe para calcular o custo
unitário quando compra e uso estão na mesma família.

| slug | Rótulo | Família | Base | Fator |
|---|---|---|---|---:|
| `unit` | unidade | contagem | `unit` | 1 |
| `pair` | par | contagem | `unit` | 2 |
| `box` | caixa | contagem | — | informado pela usuária |
| `g` | grama | massa | `g` | 1 |
| `kg` | quilograma | massa | `g` | 1000 |
| `ml` | mililitro | volume | `ml` | 1 |
| `l` | litro | volume | `ml` | 1000 |
| `m` | metro | comprimento | `cm` | 100 |
| `cm` | centímetro | comprimento | `cm` | 1 |
| `custom` | personalizada | — | — | — |

Regras:

- compra e uso devem pertencer à mesma família; caso contrário, o sistema pede
  a conversão explicitamente;
- `box` exige que a usuária informe quantas unidades a caixa contém;
- `pair` é convertido para unidade apenas quando o consumo é por peça avulsa;
- `l`, `cm` e `pair` são extensões da lista mínima de `RF-03` e não alteram
  nenhuma fórmula do motor.

## 5. Categorias de material

Transversais a todos os segmentos:

| slug | Rótulo | Unidade típica |
|---|---|---|
| `disposables` | Descartáveis | `unit` |
| `hygiene` | Higiene e biossegurança | `unit` |
| `cotton` | Algodão e papel | `g` |
| `gloves` | Luvas e máscaras | `unit` |
| `packaging` | Embalagens e brindes | `unit` |
| `sanitizing` | Esterilização e limpeza | `ml` |
| `other` | Outros | `unit` |

Unhas:

| slug | Rótulo | Unidade típica |
|---|---|---|
| `gel` | Gel construtor | `g` |
| `polish` | Esmalte | `ml` |
| `fiber` | Fibra de vidro | `cm` |
| `tips` | Tips e moldes | `unit` |
| `glue` | Cola e resina | `g` |
| `primer` | Primer e desidratador | `ml` |
| `top_coat` | Top coat e base | `ml` |
| `remover` | Removedor e acetona | `ml` |
| `files` | Lixas e buffers | `unit` |
| `bits` | Brocas e pontas | `unit` |
| `decoration` | Decoração e pedrarias | `unit` |

Cílios, sobrancelhas e depilação:

| slug | Rótulo | Unidade típica |
|---|---|---|
| `lash_trays` | Fios e bandejas | `unit` |
| `lash_glue` | Cola de cílios | `ml` |
| `lash_care` | Primer, selante e removedor | `ml` |
| `tint` | Henna e tintura | `g` |
| `wax` | Cera e pós-depilatório | `g` |

Cabelo, estética e maquiagem:

| slug | Rótulo | Unidade típica |
|---|---|---|
| `color` | Coloração e oxidante | `g` |
| `treatment` | Tratamento e finalizador | `ml` |
| `shampoo` | Shampoo e condicionador | `ml` |
| `skincare` | Cosméticos e ativos | `ml` |
| `makeup_products` | Produtos de maquiagem | `unit` |

O catálogo apresentado no cadastro deve priorizar as categorias do segmento
escolhido no onboarding, mantendo as transversais sempre visíveis.

## 6. Categorias de custo fixo

| slug | Rótulo | Observação |
|---|---|---|
| `rent` | Aluguel | Inclui aluguel de cabine |
| `condo` | Condomínio | — |
| `electricity` | Energia | Ratear quando o espaço é residencial |
| `water` | Água | Ratear quando o espaço é residencial |
| `gas` | Gás | — |
| `internet` | Internet | — |
| `phone` | Telefone e celular | — |
| `software` | Sistemas e assinaturas | Inclui a assinatura do próprio produto |
| `accounting` | Contador | — |
| `taxes` | MEI e impostos fixos | Somente tributos de valor fixo mensal |
| `marketing` | Marketing e anúncios | — |
| `maintenance` | Manutenção e reparos | — |
| `cleaning` | Limpeza e conservação | — |
| `transport` | Transporte e combustível | — |
| `insurance` | Seguros | — |
| `training` | Cursos e capacitação | — |
| `equipment_reserve` | Reserva para equipamentos | Calculada, ver documento 07 |
| `other` | Outros | — |

Não são custos fixos e não devem aparecer nesta lista:

- taxa de cartão, Pix ou marketplace: é taxa sobre a venda (`TV`);
- comissão por atendimento: é outro custo direto (`OD`);
- compra de material: pertence ao cadastro de materiais;
- retirada da profissional: é remunerada pelo valor/hora.

A linha `equipment_reserve` é gerada pelo sistema e não pode ser editada
manualmente, para evitar contagem dupla com o cadastro de equipamentos.

## 7. Categorias de serviço

Semente por segmento, usada para acelerar o cadastro e para as páginas de
conteúdo descritas no documento 05.

| Segmento | Categorias |
|---|---|
| `nails` | Alongamento, manutenção, esmaltação, manicure e pedicure, remoção, decoração |
| `lashes` | Extensão fio a fio, volume, manutenção, remoção, lifting |
| `brows` | Design, henna, coloração, laminação |
| `hair` | Corte, coloração, escova, tratamento, penteado, progressiva |
| `esthetics` | Limpeza de pele, massagem, drenagem, peeling, corporal |
| `makeup` | Social, noiva, artística |
| `waxing` | Facial, corporal, masculina |

## 8. Tipos de equipamento

Lista usada pelo cadastro descrito no documento 07.

`uv_lamp`, `nail_drill`, `dust_collector`, `autoclave`, `sterilizer`, `bed`,
`chair`, `stool`, `table`, `trolley`, `ring_light`, `lamp`, `hair_dryer`,
`flat_iron`, `steamer`, `card_reader`, `computer`, `phone`, `air_conditioner`,
`cabinet`, `other`.

## 9. Manutenção das listas

- alterações no catálogo são versionadas junto com a aplicação;
- remover um item significa marcá-lo como inativo, preservando os registros
  históricos que já o utilizam;
- categorias personalizadas frequentes devem ser revisadas periodicamente como
  candidatas ao catálogo global;
- nenhum texto do catálogo deve prometer resultado financeiro nem sugerir preço
  de mercado.
