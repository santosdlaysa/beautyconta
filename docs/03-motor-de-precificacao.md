# Motor de precificação

## 1. Objetivo

O motor deve produzir resultados reproduzíveis, transparentes e independentes da
interface. Cada cálculo salva a versão da fórmula e uma fotografia das entradas.

## 2. Definições

- **Custo de materiais (CM):** soma do custo consumido de cada material.
- **Custo de mão de obra (MO):** duração produtiva multiplicada pelo valor/hora.
- **Rateio de custos fixos (CF):** parcela dos custos mensais atribuída ao
  serviço.
- **Outros custos diretos (OD):** deslocamento, descartáveis informados como
  total, comissão fixa e semelhantes.
- **Taxa sobre a venda (TV):** percentual cobrado sobre o preço, como cartão ou
  marketplace.
- **Margem desejada (M):** lucro desejado como percentual do preço de venda.

Percentuais são usados na forma decimal nas fórmulas: 30% = 0,30.

## 3. Materiais

Para um material:

```text
custo_unitario = preco_compra / quantidade_comprada
custo_consumido = custo_unitario × quantidade_usada × (1 + percentual_perda)
```

O custo de materiais é a soma dos itens usados:

```text
CM = soma(custo_consumido_de_cada_material)
```

Exemplo: gel de R$ 90 com 24 g, uso de 1,5 g e sem perda:

```text
custo_unitario = 90 / 24 = R$ 3,75 por g
custo_consumido = 3,75 × 1,5 = R$ 5,625
```

O motor mantém precisão interna e arredonda valores monetários somente nos
pontos definidos. A interface exibe R$ 5,63.

## 4. Mão de obra

### Valor/hora informado

```text
MO = (duracao_minutos / 60) × valor_hora
```

### Valor/hora calculado

```text
horas_produtivas_mes = dias_trabalhados × horas_produtivas_dia
valor_hora = retirada_mensal_desejada / horas_produtivas_mes
```

A retirada desejada remunera o trabalho da profissional. Ela não deve ser
duplicada como custo fixo.

## 5. Rateio de custos fixos

O produto deve oferecer dois métodos e identificar qual foi usado.

### Por hora produtiva — recomendado

```text
custo_fixo_hora = custos_fixos_mensais / horas_produtivas_mes
CF = custo_fixo_hora × (duracao_minutos / 60)
```

Esse método distribui mais custo para serviços longos.

### Por atendimento — simplificado

```text
CF = custos_fixos_mensais / atendimentos_estimados_mes
```

Esse método é mais fácil, mas pode distorcer a comparação entre serviços de
durações muito diferentes.

## 6. Preço mínimo e preço recomendado

Base de custos sem percentuais sobre venda:

```text
C = CM + MO + CF + OD
```

Quando há taxa sobre venda, o preço de equilíbrio é:

```text
preco_minimo = C / (1 - TV)
```

Para obter margem `M` sobre o preço de venda e pagar taxa `TV`:

```text
preco_recomendado = C / (1 - TV - M)
```

É obrigatório validar:

```text
TV + M < 1
```

Somar 30% ao custo é um acréscimo (*markup*), não uma margem de 30% sobre a
venda. Sem taxas, custo de R$ 120 com margem de 30% resulta em:

```text
120 / (1 - 0,30) = R$ 171,428571...
```

Preço exibido antes do arredondamento comercial: **R$ 171,43**.

## 7. Resultado de um preço informado

Para um preço de venda `P`:

```text
taxa_em_reais = P × TV
lucro_em_reais = P - C - taxa_em_reais
margem_real = lucro_em_reais / P
```

Se `P` for zero, a margem percentual não deve ser calculada.

## 8. Exemplo completo

Entradas:

| Componente | Valor |
|---|---:|
| Materiais | R$ 30,00 |
| 2h30 de mão de obra a R$ 28/h | R$ 70,00 |
| Custos fixos rateados | R$ 20,00 |
| Outros custos | R$ 0,00 |
| Taxa sobre venda | 0% |
| Margem desejada | 30% |

Resultado:

```text
C = 30 + 70 + 20 = R$ 120,00
preco_minimo = R$ 120,00
preco_recomendado = 120 / 0,70 = R$ 171,43
lucro_estimado = 171,43 - 120 = R$ 51,43
```

## 9. Arredondamento comercial

O cálculo base usa centavos. Depois, a usuária pode escolher:

- sem arredondamento adicional;
- próximo múltiplo de R$ 1;
- próximo múltiplo de R$ 5;
- próximo múltiplo de R$ 10;
- final em `,90`.

Por padrão, o preço recomendado deve ser arredondado **para cima**, para não
reduzir a margem desejada. O resultado deve mostrar o valor calculado e o valor
comercial quando forem diferentes.

## 10. Simulador de meta

Uma meta precisa distinguir retirada da profissional e lucro do negócio.

Versão inicial:

```text
lucro_medio_necessario = meta_lucro_mensal / atendimentos_estimados_mes
```

Para um serviço representativo:

```text
preco_para_meta = (C + lucro_medio_necessario) / (1 - TV)
```

Uma versão futura pode usar o mix real de serviços. A interface não deve afirmar
que a meta será atingida; deve informar que é uma projeção dependente do número e
do tipo de atendimentos.

## 11. Regras de validação

- preços e custos: maiores ou iguais a zero;
- quantidade comprada e horas produtivas: maiores que zero;
- quantidade usada: maior ou igual a zero;
- duração do serviço: de 1 a 1.440 minutos;
- taxa: de 0% a 99%, respeitando a soma com margem;
- margem: de 0% a 95%;
- atendimentos mensais: inteiro maior que zero;
- campos monetários: limite operacional documentado e protegido contra overflow.

## 12. Versionamento e testes obrigatórios

Cada resultado deve guardar `calculation_version`, começando em `1`. Alterações
futuras na fórmula criam nova versão; não mudam cálculos históricos.

Testes mínimos:

- material fracionado e múltiplos materiais;
- perda de material;
- duração com minutos quebrados;
- rateio por hora e por atendimento;
- margem zero;
- taxa de pagamento;
- taxa mais margem inválida;
- preço atual abaixo do custo;
- arredondamento para cada estratégia;
- valores monetários grandes;
- resultado histórico imutável.

