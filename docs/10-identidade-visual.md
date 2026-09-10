# Identidade visual mínima

## 1. Objetivo

Registrar a identidade já aplicada na página pública para que telas novas
nasçam coerentes sem depender de leitura do CSS. Os valores abaixo são os que
estão em `app/globals.css`, não uma proposta paralela.

## 2. Cores

| Token | Valor | Uso |
|---|---|---|
| `--ink` | `#201b1f` | Texto principal e botão escuro |
| `--muted` | `#71686e` | Texto de apoio |
| `--paper` | `#fffdfb` | Fundo padrão |
| `--cream` | `#fbf7f4` | Fundo de seção alternada |
| `--rose` | `#a63d66` | Cor da marca, ação primária |
| `--rose-dark` | `#7f274a` | Números em destaque, links de texto |
| `--rose-soft` | `#f8e8ee` | Fundo de realce e etiquetas |
| `--line` | `#eadfe3` | Bordas e divisores |
| `--green` | `#42745e` | Resultado positivo |
| `--shadow` | `0 20px 60px rgba(79,38,56,.12)` | Elevação de cartões |

Falta apenas um token: **vermelho de alerta**, hoje aplicado direto na classe
`.current-alert.danger`. Ao criar as telas autenticadas, promovê-lo a
`--danger`, sem alterar o tom já em uso.

### Contraste

Todas as combinações em uso atingem WCAG AA para texto normal:

| Combinação | Razão |
|---|---:|
| `--ink` sobre `--paper` | 16,7 |
| `--rose-dark` sobre `--paper` | 9,0 |
| `--rose` sobre `--paper` | 6,0 |
| branco sobre `--rose` | 6,0 |
| `--muted` sobre `--paper` | 5,3 |
| `--green` sobre `--paper` | 5,3 |
| `--rose` sobre `--rose-soft` | 5,1 |

Regra: nenhum par novo entra no produto abaixo de 4,5. Cor nunca é o único
sinal de estado; prejuízo e alerta trazem também ícone e texto.

## 3. Tipografia

- Títulos: Playfair Display, peso 500, `letter-spacing` negativo, variável
  `--font-display`.
- Texto e interface: DM Sans, variável `--font-sans`.
- Números de resultado usam a fonte de título, para que o preço seja o elemento
  mais forte da tela.
- Títulos de seção usam `clamp()` e nunca tamanho fixo.

## 4. Formas e elevação

- Botões e etiquetas: raio total, `999px`, altura mínima de 48 px.
- Cartões: raio de 18 px no celular e até 30 px em telas grandes.
- O losango do logo usa raio assimétrico `50% 50% 45% 55%`, que é a assinatura
  visual da marca e não deve ser substituído por círculo.
- Sombra sempre pelo token, nunca inventada por componente.

## 5. Movimento

- Transições de 200 ms em transformação, sombra e fundo.
- Elevação no hover limitada a 2 px.
- `prefers-reduced-motion` já é respeitado globalmente; qualquer animação nova
  precisa entrar nessa mesma regra.

## 6. Voz aplicada à interface

Coerente com a seção 7 do documento 01:

- tratar a usuária por "você", nunca por diminutivo;
- números sempre acompanhados do que representam: "seu custo", "seu lucro";
- nunca usar "faturamento" e "lucro" como sinônimos;
- alerta descreve a situação e oferece a ação, sem julgar a profissional;
- todo resultado carrega a frase de que é estimativa baseada nos dados
  informados.

## 7. O que já existe e o que falta

Feito em 2026-09-10, em `web/src/config/brand.ts` e `web/src/components/brand.tsx`:

- **logotipo vetorial**, com a forma da seção 4 transcrita para SVG e a faísca
  que o produto já usava — o losango e a letra B em CSS saíram;
- **favicon** em 16 e 32 pixels, desenhado para o tamanho pequeno e não
  reduzido a partir do logotipo: só a marca, sem o nome;
- **imagem de compartilhamento** de todas as páginas, inclusive a inicial.

O nome continua sendo texto de verdade ao lado da marca, e não vetor: assim é
lido em voz alta, cresce com a tipografia do sistema e não depende da fonte ter
carregado para caber na caixa.

Continua faltando:

- **ícones de instalação do PWA** (`apple-icon`, `manifest.webmanifest`);
- **imagem própria da página de agendamento**, que hoje herda a da inicial — a
  página que a cliente recebe merecia o nome do negócio na imagem;
- **versão escura**, que não é requisito do MVP.
