import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { SITE_URL } from "@/config/site";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
});

/**
 * Sem `metadataBase`, as URLs canônicas e as imagens de compartilhamento das
 * páginas do item C-04 sairiam relativas e nenhuma rede social as resolveria.
 * A origem vem de `config/site`, que decide entre o recuo de desenvolvimento e
 * a falha de construção.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "BeautyConta — Precifique seu talento",
    template: "%s",
  },
  description:
    "Descubra quanto cobrar pelos seus serviços de beleza sem trabalhar no prejuízo.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "BeautyConta",
  },
  /**
   * A imagem de `app/opengraph-image` é retangular e larga. Sem declarar o
   * formato do cartão, o X a recorta em um quadrado pequeno e o título fica
   * ilegível — as páginas do item C-04 já declaravam uma a uma; aqui vale para
   * a página inicial e para a agenda pública.
   */
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${dmSans.variable} ${playfair.variable}`}>{children}</body>
    </html>
  );
}
