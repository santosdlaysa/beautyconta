import { ImageResponse } from "next/og";
import { SERVICE_PAGES, findServicePage } from "@/content/service-pages";

/**
 * Imagem de compartilhamento exigida pelo item C-04.
 *
 * É gerada a partir do próprio conteúdo da página, e não desenhada uma a uma,
 * porque a seção 7 do documento 10 registra que a marca ainda não tem arquivo
 * vetorial: as cores do documento aplicadas em texto são o que dá para
 * garantir hoje sem inventar identidade nova.
 */

export const alt = "Calculadora gratuita de preço da BeautyConta";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return SERVICE_PAGES.map((page) => ({ slug: page.slug }));
}

const INK = "#201b1f";
const ROSE = "#a63d66";
const ROSE_SOFT = "#f8e8ee";
const PAPER = "#fffdfb";

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = findServicePage(slug);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: PAPER,
          borderBottom: `24px solid ${ROSE}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: ROSE,
              color: PAPER,
              borderRadius: 32,
              fontSize: 36,
            }}
          >
            B
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: INK }}>BeautyConta</div>
          <div
            style={{
              display: "flex",
              marginLeft: 16,
              padding: "10px 20px",
              borderRadius: 999,
              background: ROSE_SOFT,
              color: "#7f274a",
              fontSize: 22,
            }}
          >
            {page?.segment ?? "Precificação"}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 72, lineHeight: 1.1, color: INK, letterSpacing: -2 }}>
            {page?.heading ?? "Saiba quanto cobrar sem trabalhar no prejuízo"}
          </div>
          <div style={{ display: "flex", fontSize: 34, color: "#5c5359" }}>
            {page?.shareLine ?? "Calculadora gratuita para profissionais da beleza."}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "#7f274a" }}>
          Calcule grátis, sem cadastro · beautyconta
        </div>
      </div>
    ),
    size,
  );
}
