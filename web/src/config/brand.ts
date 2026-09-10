/**
 * A marca em valores literais.
 *
 * O favicon e as imagens de compartilhamento são desenhadas por `next/og`, que
 * roda fora do navegador e não enxerga as variáveis de `globals.css`. Sem um
 * lugar só para essas cores, cada arquivo copiaria o seu rosa e, na primeira
 * vez que a paleta da seção 2 do documento 10 mudasse, a aba do navegador e o
 * link mandado no WhatsApp ficariam com um tom diferente do site — divergência
 * que ninguém vê revisando código, só meses depois numa captura de tela.
 *
 * Os valores abaixo são os mesmos tokens de `globals.css`, não uma paleta
 * paralela. Ao alterar um, altere os dois.
 */
export const BRAND_COLORS = {
  ink: "#201b1f",
  muted: "#71686e",
  paper: "#fffdfb",
  rose: "#a63d66",
  roseDark: "#7f274a",
  roseSoft: "#f8e8ee",
  white: "#ffffff",
} as const;

/**
 * Contorno do losango da marca, em uma caixa de 32 por 32.
 *
 * É a transcrição em vetor do `border-radius: 50% 50% 45% 55%` que a seção 4 do
 * documento 10 chama de assinatura visual — com os raios já reduzidos na
 * proporção que o próprio navegador aplica quando a soma de dois cantos passa
 * do lado do quadrado. Transcrito, e não redesenhado, porque o objetivo era
 * tirar a marca do CSS sem mudar a forma que já está no ar.
 */
export const BRAND_SHAPE_PATH =
  "M15.238 0H16.762A15.238 15.238 0 0 1 32 15.238V18.286A13.714 13.714 0 0 1 18.286 32H16.762A16.762 16.762 0 0 1 0 15.238A15.238 15.238 0 0 1 15.238 0Z";

/**
 * A faísca, na mesma caixa de 32 por 32.
 *
 * É a `SparkleIcon` de `components/icons`, que o aplicativo já usa ao lado do
 * nome, convertida de traço para preenchimento e engordada perto do centro. O
 * traço de 1,8 px do ícone de interface some abaixo de 24 px; preenchida e com
 * a cintura mais larga, a silhueta continua legível nos 16 px da aba do
 * navegador. Mesmo símbolo, não um novo.
 */
export const BRAND_SPARKLE_PATH =
  "M16 5c1.76 7.26 3.96 9.79 11 11-7.26 1.76-9.79 3.96-11 11-1.76-7.26-3.96-9.79-11-11 7.26-1.76 9.79-3.96 11-11Z";
