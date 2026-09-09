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
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${dmSans.variable} ${playfair.variable}`}>{children}</body>
    </html>
  );
}
