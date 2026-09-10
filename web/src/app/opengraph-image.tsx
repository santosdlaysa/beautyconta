import { ImageResponse } from "next/og";
import { ShareFrame, SHARE_IMAGE_SIZE } from "@/components/share-frame";

/**
 * Imagem de compartilhamento da raiz do site.
 *
 * As oito páginas de conteúdo já tinham a sua e a página inicial, não — que é
 * justamente o endereço que a profissional manda para uma colega no WhatsApp.
 * Sem `og:image` a mensagem sai como um link cinza, e o primeiro contato com o
 * produto vira uma URL sem rosto.
 *
 * Por ficar na raiz de `app/`, vale também para `/agendar/[slug]`, a página que
 * a cliente recebe. Não é o ideal para ela, que mereceria a foto do negócio,
 * mas é melhor do que nada até existir.
 */

export const alt =
  "BeautyConta: saiba quanto cobrar pelos seus serviços de beleza sem trabalhar no prejuízo";
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <ShareFrame
        badge="Calculadora gratuita"
        heading="Saiba quanto cobrar sem trabalhar no prejuízo."
        line="Materiais, tempo e custos fixos entram na conta antes de você definir o preço."
      />
    ),
    size,
  );
}
