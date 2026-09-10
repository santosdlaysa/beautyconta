import { BrandMark } from "@/components/brand";
import { BRAND_COLORS } from "@/config/brand";

/**
 * O enquadramento das imagens de compartilhamento.
 *
 * As oito páginas por intenção de busca já tinham a sua, e a inicial passou a
 * ter. São nove imagens que só cumprem o papel se forem reconhecíveis como a
 * mesma marca: quem recebe o link no WhatsApp vê a imagem antes de ler a URL.
 * Mantê-las em um componente só é o que impede que a nona nasça parecida e as
 * oito envelheçam diferentes.
 *
 * Escrito com `display: flex` declarado em cada nível e sem atalho de CSS
 * porque `next/og` não é um navegador: ele resolve um subconjunto do layout, e
 * o que ele não entende não falha — sai torto na imagem que já foi enviada.
 */

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

type ShareFrameProps = {
  /** Etiqueta curta do topo; nas páginas de serviço é o segmento atendido. */
  badge: string;
  heading: string;
  line: string;
};

export function ShareFrame({ badge, heading, line }: ShareFrameProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: BRAND_COLORS.paper,
        borderBottom: `24px solid ${BRAND_COLORS.rose}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <BrandMark size={64} />
        {/* O nome vive em uma linha própria: o `gap` do topo separa marca,
            nome e etiqueta, e se as duas metades da palavra fossem irmãs dele
            "beauty" e "conta" sairiam afastadas como se fossem duas palavras. */}
        <div style={{ display: "flex", fontSize: 34 }}>
          <div style={{ display: "flex", fontWeight: 700, color: BRAND_COLORS.ink }}>beauty</div>
          <div style={{ display: "flex", color: BRAND_COLORS.rose }}>conta</div>
        </div>
        <div
          style={{
            display: "flex",
            marginLeft: 16,
            padding: "10px 20px",
            borderRadius: 999,
            background: BRAND_COLORS.roseSoft,
            color: BRAND_COLORS.roseDark,
            fontSize: 22,
          }}
        >
          {badge}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            display: "flex",
            fontSize: 72,
            lineHeight: 1.1,
            color: BRAND_COLORS.ink,
            letterSpacing: -2,
          }}
        >
          {heading}
        </div>
        <div style={{ display: "flex", fontSize: 34, color: BRAND_COLORS.muted }}>{line}</div>
      </div>

      <div style={{ display: "flex", fontSize: 26, color: BRAND_COLORS.roseDark }}>
        Calcule grátis, sem cadastro · beautyconta
      </div>
    </div>
  );
}
