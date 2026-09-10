import { ImageResponse } from "next/og";
import { ShareFrame, SHARE_IMAGE_SIZE } from "@/components/share-frame";
import { SERVICE_PAGES, findServicePage } from "@/content/service-pages";

/**
 * Imagem de compartilhamento exigida pelo item C-04.
 *
 * É gerada a partir do próprio conteúdo da página, e não desenhada uma a uma,
 * porque são oito e elas mudam junto com o texto: escrever a imagem à mão seria
 * garantir que uma delas ficasse falando de outro serviço.
 *
 * O enquadramento veio para `components/share-frame` quando a página inicial
 * ganhou a sua — nove imagens com o mesmo topo só continuam iguais se houver um
 * lugar só onde esse topo é definido.
 */

export const alt = "Calculadora gratuita de preço da BeautyConta";
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return SERVICE_PAGES.map((page) => ({ slug: page.slug }));
}

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = findServicePage(slug);

  return new ImageResponse(
    (
      <ShareFrame
        badge={page?.segment ?? "Precificação"}
        heading={page?.heading ?? "Saiba quanto cobrar sem trabalhar no prejuízo"}
        line={page?.shareLine ?? "Calculadora gratuita para profissionais da beleza."}
      />
    ),
    size,
  );
}
