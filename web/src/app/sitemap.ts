import type { MetadataRoute } from "next";
import { SITE_URL } from "@/config/site";
import { SERVICE_PAGES } from "@/content/service-pages";

/**
 * As páginas do item C-04 só cumprem o papel de aquisição orgânica se o
 * buscador souber que elas existem. Como não há links externos apontando para
 * elas ainda, o sitemap é o único caminho de descoberta além do rodapé.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/termos`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/excluir-conta`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacidade`, changeFrequency: "yearly", priority: 0.3 },
    ...SERVICE_PAGES.map((page) => ({
      url: `${SITE_URL}/${page.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
