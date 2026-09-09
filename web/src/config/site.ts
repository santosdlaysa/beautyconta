/**
 * Endereço público do site, usado no `metadataBase`, nas URLs canônicas, nas
 * imagens de compartilhamento das páginas do item C-04 e no sitemap.
 *
 * O recuo silencioso para `localhost` só é aceitável em desenvolvimento. Em
 * produção ele é pior que um erro visível: o site sobe, o buscador indexa a
 * canônica errada e o link compartilhado no Instagram ou no WhatsApp não
 * resolve a imagem — tudo sem nenhum sinal de que algo falhou. Uma construção
 * que quebra com mensagem clara custa minutos; uma canônica errada publicada
 * custa reindexação e alcance.
 */

const DEVELOPMENT_FALLBACK = "http://localhost:3000";

export const MISSING_SITE_URL_MESSAGE =
  "NEXT_PUBLIC_SITE_URL não está definida. Defina o endereço público do site, sem barra no final, antes de construir para produção. Veja web/.env.example.";

export const INVALID_SITE_URL_MESSAGE =
  "NEXT_PUBLIC_SITE_URL precisa ser um endereço absoluto começando por http:// ou https://, sem barra no final. Veja web/.env.example.";

/**
 * Recebe a variável e o ambiente por parâmetro para que o comportamento em
 * produção possa ser verificado em teste sem depender do ambiente de quem roda.
 */
export function resolveSiteUrl(rawUrl: string | undefined, nodeEnv: string | undefined): string {
  const configured = rawUrl?.trim();

  if (!configured) {
    if (nodeEnv === "production") throw new Error(MISSING_SITE_URL_MESSAGE);
    return DEVELOPMENT_FALLBACK;
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error(INVALID_SITE_URL_MESSAGE);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(INVALID_SITE_URL_MESSAGE);
  }

  // A barra final duplicaria a barra das URLs montadas a partir daqui.
  return configured.replace(/\/+$/, "");
}

export const SITE_URL = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, process.env.NODE_ENV);
