import { BRAND_COLORS, BRAND_SHAPE_PATH, BRAND_SPARKLE_PATH } from "@/config/brand";

/**
 * A marca, em vetor.
 *
 * A seção 7 do documento 10 registrava que o logotipo só existia como CSS: um
 * `div` com raio assimétrico e a letra B. Isso funciona dentro de uma página e
 * em nenhum outro lugar — o favicon e as imagens de compartilhamento são
 * desenhados por `next/og`, que recebe elementos, não folha de estilo. Em
 * vetor, a mesma marca serve o cabeçalho, a aba do navegador e o link
 * compartilhado sem ninguém redesenhá-la de memória em cada um.
 *
 * A letra B saiu no lugar da faísca porque o favicon precisa se resolver em
 * 16 px, e um B em serifada itálica — que é como o CSS o desenha — vira borrão
 * nesse tamanho. A faísca não é símbolo novo: é a que o aplicativo já põe ao
 * lado do nome e a que a página inicial já usa no rótulo do topo.
 */

type BrandMarkProps = {
  size?: number;
  /** Cor do losango; a faísca sai vazada nele. */
  background?: string;
  foreground?: string;
};

export function BrandMark({
  size = 34,
  background = BRAND_COLORS.rose,
  foreground = BRAND_COLORS.white,
}: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      // `globals.css` dimensiona todo `svg` em 1,2 em para os ícones de
      // interface; sem o estilo em linha, que vence a folha, a marca herdaria
      // o tamanho do texto ao redor em vez do que o chamador pediu.
      style={{ width: size, height: size, flexShrink: 0 }}
      aria-hidden="true"
      focusable="false"
    >
      <path d={BRAND_SHAPE_PATH} fill={background} />
      <path d={BRAND_SPARKLE_PATH} fill={foreground} />
    </svg>
  );
}

/**
 * Marca e nome lado a lado, como o aplicativo se apresenta na tela inicial:
 * "beauty" na cor do texto, "conta" na cor da marca.
 *
 * O nome continua sendo texto de verdade, e não `<text>` dentro do SVG, porque
 * a largura de um `<text>` depende da fonte que o navegador conseguiu carregar:
 * enquanto a DM Sans não chega, ou se ela falhar, a palavra é medida pela fonte
 * de recuo e escapa da `viewBox`, que corta o que passar. Como texto, ela
 * também é lida em voz alta, encontrada pelo buscar da página e cresce junto
 * com o `font-size` de quem aumenta a tipografia do sistema.
 */
export function BrandLogo({ markSize = 34 }: { markSize?: number }) {
  return (
    <>
      <BrandMark size={markSize} />
      <span className="wordmark">
        beauty<span className="wordmark-accent">conta</span>
      </span>
    </>
  );
}
