import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand";

/**
 * Favicon, pendência aberta na seção 7 do documento 10.
 *
 * São dois tamanhos, e não um redimensionado pelo navegador, porque é nos 16 px
 * que o ícone é julgado: a aba com muitas páginas abertas é onde a profissional
 * precisa reconhecer o BeautyConta sem ler o título. Declarar 16 e 32 deixa o
 * navegador escolher o arquivo já desenhado no tamanho certo em vez de reduzir
 * o maior e embaralhar as pontas da faísca.
 *
 * O desenho é a marca sozinha — losango e faísca, sem o nome. Nome reduzido a
 * 16 px não é logotipo pequeno, é ruído.
 */

const SIZES = [16, 32];

export function generateImageMetadata() {
  // Sem `alt`: o Next o repassaria para o `<link rel="icon">`, que não tem esse
  // atributo. Ícone de aba não é conteúdo lido em voz alta.
  return SIZES.map((pixels) => ({
    id: String(pixels),
    contentType: "image/png",
    size: { width: pixels, height: pixels },
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const pixels = Number(await id);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <BrandMark size={pixels} />
      </div>
    ),
    { width: pixels, height: pixels },
  );
}
