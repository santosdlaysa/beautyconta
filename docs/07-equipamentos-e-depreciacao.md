# Equipamentos e reserva para reposição

## 1. Objetivo

Cabine, lixadeira, maca, autoclave e ring light custam caro, duram alguns anos e
precisam ser repostos. Se esse desgaste não entra na conta, o preço parece
saudável até o equipamento quebrar e a compra sair do lucro do mês.

Este documento define como o produto transforma equipamentos em uma parcela
mensal previsível, sem exigir que a usuária entenda contabilidade.

## 2. Escopo e fase

Fora do MVP. A entrega prevista é a Fase 3, junto com metas e projeções, nos
planos Premium e Master. O MVP permanece com custos fixos informados
manualmente; quem quiser considerar equipamentos antes disso pode lançar um
custo fixo comum.

Esta funcionalidade não substitui a contabilidade do negócio e não deve ser
apresentada como cálculo fiscal de depreciação.

## 3. Vocabulário na interface

O termo contábil é depreciação. Na interface, ele não deve aparecer sozinho.

- Título: "Reserva para reposição de equipamentos".
- Explicação: "Guardando este valor por mês, você consegue repor o equipamento
  quando ele acabar."
- Evitar: "amortização", "vida útil fiscal", "ativo imobilizado".

## 4. Definições

- **Valor de aquisição:** quanto foi pago pelo equipamento.
- **Vida útil estimada:** por quantos meses a usuária espera utilizá-lo.
- **Valor residual:** quanto ela espera receber ao revendê-lo, opcional e zero
  por padrão.
- **Reserva mensal:** parcela mensal correspondente ao desgaste.

## 5. Fórmula

```text
reserva_mensal = (valor_aquisicao - valor_residual) / vida_util_meses
```

A reserva total do negócio é a soma dos equipamentos ativos:

```text
RE = soma(reserva_mensal de cada equipamento ativo)
```

Exemplo, cabine de R$ 1.200 com vida útil de 36 meses e sem valor residual:

```text
reserva_mensal = 1200 / 36 = R$ 33,33
```

## 6. Integração com o motor de precificação

A reserva **não** cria um novo termo nas fórmulas do documento 03. Ela entra nos
custos fixos mensais:

```text
custos_fixos_mensais = soma(despesas ativas) + RE
```

Depois disso, o rateio segue exatamente as regras da seção 5 do documento 03,
por hora produtiva ou por atendimento. O resultado deve identificar quanto do
`CF` veio de equipamentos, para que a composição continue explicável.

Para evitar contagem dupla:

- a linha `equipment_reserve` do catálogo de custos fixos é calculada pelo
  sistema e bloqueada para edição manual;
- ao cadastrar o primeiro equipamento, o sistema verifica se já existe um custo
  fixo manual com nome semelhante e pede confirmação;
- equipamento arquivado deixa de somar no mês seguinte ao arquivamento.

## 7. Vidas úteis de referência

Valores apenas para pré-preencher o formulário. São editáveis e não constituem
recomendação contábil.

| Tipo | slug | Referência |
|---|---|---:|
| Cabine UV/LED | `uv_lamp` | 36 meses |
| Lixadeira ou motor | `nail_drill` | 36 meses |
| Aspirador de pó | `dust_collector` | 36 meses |
| Autoclave | `autoclave` | 60 meses |
| Estufa ou esterilizador | `sterilizer` | 48 meses |
| Maca | `bed` | 60 meses |
| Cadeira | `chair` | 48 meses |
| Banqueta | `stool` | 36 meses |
| Mesa ou bancada | `table` | 60 meses |
| Carrinho auxiliar | `trolley` | 48 meses |
| Ring light | `ring_light` | 24 meses |
| Luminária | `lamp` | 36 meses |
| Secador | `hair_dryer` | 24 meses |
| Prancha | `flat_iron` | 24 meses |
| Vaporizador | `steamer` | 48 meses |
| Máquina de cartão | `card_reader` | 36 meses |
| Computador | `computer` | 48 meses |
| Celular | `phone` | 24 meses |
| Ar-condicionado | `air_conditioner` | 60 meses |
| Armário | `cabinet` | 60 meses |
| Outro | `other` | 36 meses |

## 8. Regras de validação

- valor de aquisição: maior que zero;
- vida útil: inteiro entre 1 e 240 meses;
- valor residual: maior ou igual a zero e menor que o valor de aquisição;
- data de aquisição: opcional, não pode ser futura;
- equipamento com vida útil já vencida continua listado, com aviso de que a
  reserva foi concluída, e deixa de somar em `RE`;
- alterar um equipamento não recalcula cálculos históricos, conforme a regra de
  imutabilidade do documento 02.

## 9. Modelo de dados

### equipment

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

A reserva mensal é derivada e não é persistida como coluna; ela é recalculada na
leitura e congelada dentro de `pricing_calculations` no momento do cálculo.

## 10. Interface

Lista de equipamentos com nome, valor, vida útil e reserva mensal, e um total
destacado: "Seus equipamentos representam R$ X por mês".

Ao concluir o cadastro, mostrar o efeito no preço de um serviço já existente,
para que a mudança seja compreendida em vez de apenas somar um número.

## 11. Riscos

- **Percepção de preço inflado:** a reserva aumenta o preço recomendado. Mostrar
  sempre o antes e o depois e permitir desativar o cálculo.
- **Contagem dupla:** tratada na seção 6.
- **Vida útil irreal:** vidas muito curtas inflam a reserva. Avisar quando o
  valor informado for inferior a 12 meses.
- **Confusão com contabilidade:** a interface deve declarar que o cálculo é
  gerencial e não substitui orientação contábil.
