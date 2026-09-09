import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PricingCalculator } from "@/components/calculator";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ArrowIcon, CheckIcon, CoinIcon, HelpIcon, SparkleIcon } from "@/components/icons";
import { EXAMPLE_DISCLAIMER, SERVICE_PAGES, findServicePage } from "@/content/service-pages";

/**
 * Item C-04: uma rota por intenção de busca da seção 7 do documento 05.
 *
 * Todas nascem estáticas — `dynamicParams` desligado — porque o valor destas
 * páginas é serem indexáveis e abrirem rápido para quem chega da busca. Slug
 * fora da lista é 404, e não uma página vazia que o buscador acabaria indexando.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return SERVICE_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = findServicePage(slug);
  if (!page) return {};

  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      type: "article",
      locale: "pt_BR",
      siteName: "BeautyConta",
      url: `/${page.slug}`,
      title: page.metaTitle,
      description: page.metaDescription,
    },
    twitter: {
      card: "summary_large_image",
      title: page.metaTitle,
      description: page.metaDescription,
    },
  };
}

export default async function ServicePageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = findServicePage(slug);
  if (!page) notFound();

  const related = page.related
    .map((relatedSlug) => findServicePage(relatedSlug))
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  /** Dado estruturado das perguntas, para a busca exibir a resposta que a página já traz. */
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <>
      <SiteHeader />
      <main id="conteudo">
        <section className="page-hero">
          <span className="eyebrow"><SparkleIcon /> {page.segment}</span>
          <h1>{page.heading}</h1>
          <p>{page.intro}</p>
          <div className="hero-actions">
            <a href="#calculadora" className="primary-button">Calcular meu preço <ArrowIcon /></a>
          </div>
          <div className="trust-line">
            <span><CheckIcon /> Sem cadastro</span>
            <span><CheckIcon /> Gratuito</span>
            <span><CheckIcon /> Resultado na hora</span>
          </div>
        </section>

        <section className="content-section" aria-labelledby="exemplo">
          <div className="section-heading">
            <span className="eyebrow"><CoinIcon /> Exemplo</span>
            <h2 id="exemplo">{page.example.title}</h2>
            <p>{page.example.summary}</p>
          </div>
          <ol className="example-list">
            {page.example.lines.map((line) => (
              <li key={line.label}>
                <div className="example-head">
                  <strong>{line.label}</strong>
                  <span className="example-value">{line.value}</span>
                </div>
                <p>{line.note}</p>
              </li>
            ))}
          </ol>
          <p className="content-note">{EXAMPLE_DISCLAIMER}</p>
        </section>

        <section className="calculator-section">
          <PricingCalculator
            preset={page.preset}
            title={page.heading}
            description="A calculadora já vem preenchida com o exemplo acima. Troque cada número pelo seu."
            origin="pagina-de-servico"
          />
        </section>

        <section className="content-section cream" aria-labelledby="custos">
          <div className="section-heading">
            <span className="eyebrow">Custos comuns</span>
            <h2 id="custos">O que costuma entrar na conta</h2>
            <p>Use como lista de conferência antes de calcular. Nem tudo se aplica ao seu jeito de trabalhar.</p>
          </div>
          <ul className="cost-grid">
            {page.commonCosts.map((cost) => (
              <li key={cost.name}>
                <strong>{cost.name}</strong>
                <p>{cost.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="content-section" aria-labelledby="perguntas">
          <div className="section-heading">
            <span className="eyebrow"><HelpIcon /> Perguntas frequentes</span>
            <h2 id="perguntas">Dúvidas de quem calcula esse serviço</h2>
          </div>
          <div className="faq-list">
            {page.faq.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="content-section cream" aria-labelledby="relacionadas">
          <div className="section-heading">
            <h2 id="relacionadas">Outras calculadoras</h2>
          </div>
          <ul className="related-grid">
            {related.map((item) => (
              <li key={item.slug}>
                <Link href={`/${item.slug}`}>
                  <span className="related-segment">{item.segment}</span>
                  <strong>{item.heading}</strong>
                  <span className="related-arrow"><ArrowIcon /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    </>
  );
}
