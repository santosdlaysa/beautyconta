import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { PricingCalculator } from "@/components/calculator";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ArrowIcon, CalculatorIcon, ChartIcon, CheckIcon, ShieldIcon, SparkleIcon } from "@/components/icons";
import { SERVICE_PAGES } from "@/content/service-pages";

/**
 * O texto segue a tabela da seção 6 do documento 01 e a regra de comunicação da
 * mesma seção: recurso futuro só aparece como "em breve".
 *
 * O Premium já vendeu "custos e taxas detalhados" como diferencial pago. O
 * ADR-0010 liberou taxa sobre venda, perda de material e outros custos diretos
 * no gratuito, inclusive na calculadora pública — continuar cobrando por isso
 * seria prometer a quem paga algo que ela já teria de graça. O que sustenta o
 * Premium hoje é volume e organização, não qualidade do cálculo.
 */
const plans = [
  {
    name: "Gratuito",
    description: "Para descobrir se você está cobrando certo.",
    price: "R$ 0",
    period: "para sempre",
    features: ["Calculadora completa, sem cadastro", "Taxa sobre venda, perdas e outros custos", "Até 3 serviços, 10 materiais e 5 custos fixos", "Simulador de preço", "5 cálculos no histórico"],
    cta: "Começar grátis",
  },
  {
    name: "Premium",
    badge: "Mais escolhido",
    description: "Para organizar preços e crescer com segurança.",
    price: "R$ 14,90",
    period: "/mês",
    features: ["Serviços, materiais e custos fixos ilimitados", "Cálculos sem limite e histórico completo", "Comparação entre cálculos", "Tabela de preços exportável", "Metas de faturamento completas", "Clientes e financeiro em breve"],
    cta: "Quero o Premium",
    featured: true,
  },
  {
    name: "Master",
    badge: "Em breve",
    description: "A gestão completa do seu negócio de beleza.",
    price: "R$ 29,90",
    period: "/mês",
    features: ["Tudo do Premium", "Agenda e estoque", "Lembretes de retorno", "Relatórios avançados", "Assistente de análise"],
    cta: "Entrar na lista",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo">
        <section className="hero" id="inicio">
          <div className="hero-glow glow-one" /><div className="hero-glow glow-two" />
          <div className="hero-content">
            <span className="eyebrow"><SparkleIcon /> Feito para profissionais da beleza</span>
            <h1>Seu talento tem valor.<br /><em>A gente faz a conta.</em></h1>
            <p>Descubra quanto cobrar por cada serviço considerando materiais, tempo e todos os custos do seu negócio.</p>
            <div className="hero-actions">
              <a href="#calculadora" className="primary-button">Calcular meu preço <ArrowIcon /></a>
              <a href="#como-funciona" className="text-link">Ver como funciona</a>
            </div>
            <div className="trust-line"><span><CheckIcon /> Sem cadastro</span><span><CheckIcon /> 100% gratuito</span><span><CheckIcon /> Resultado na hora</span></div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="floating-pill pill-one"><span>Seu lucro</span><strong>+ R$ 51,43</strong></div>
            <div className="phone-card">
              <div className="phone-top"><BrandMark size={29} /><span>Seu preço ideal</span><span className="dots">•••</span></div>
              <p>Alongamento em gel</p>
              <h2>R$ 171,43</h2>
              <div className="mini-chart"><span style={{ height: "32%" }} /><span style={{ height: "50%" }} /><span style={{ height: "42%" }} /><span style={{ height: "72%" }} /><span className="active" style={{ height: "88%" }} /></div>
              <div className="phone-stats"><div><small>Custo</small><strong>R$ 120</strong></div><div><small>Margem</small><strong>30%</strong></div></div>
            </div>
            <div className="floating-pill pill-two"><CalculatorIcon /><span><small>Preço atual</small><strong>R$ 140,00</strong></span></div>
          </div>
        </section>

        <section className="problem-strip">
          <p>Você escolhe o preço olhando a concorrência?</p>
          <strong>Pode estar pagando para trabalhar.</strong>
        </section>

        <section className="how-section" id="como-funciona">
          <div className="section-heading"><span className="eyebrow">Simples e transparente</span><h2>Da dúvida ao preço certo<br />em poucos minutos</h2><p>Sem planilhas complicadas e sem termos difíceis.</p></div>
          <div className="steps-grid">
            <article><span className="step-number" aria-hidden="true">01</span><div className="icon-box"><CalculatorIcon /></div><h3>Conte seus custos</h3><p>Informe materiais, tempo de atendimento e despesas mensais.</p></article>
            <article><span className="step-number" aria-hidden="true">02</span><div className="icon-box"><ChartIcon /></div><h3>A gente faz a conta</h3><p>A fórmula considera sua mão de obra, estrutura e margem desejada.</p></article>
            <article><span className="step-number" aria-hidden="true">03</span><div className="icon-box"><SparkleIcon /></div><h3>Cobre com confiança</h3><p>Veja o preço sugerido, seu lucro e simule outras possibilidades.</p></article>
          </div>
        </section>

        <section className="calculator-section"><PricingCalculator /></section>

        <section className="content-section" id="calculadoras" aria-labelledby="calculadoras-titulo">
          <div className="section-heading">
            <span className="eyebrow">Por serviço</span>
            <h2 id="calculadoras-titulo">Calculadoras para o<br />seu tipo de atendimento</h2>
            <p>Cada uma vem com exemplo, lista de custos comuns e as dúvidas mais frequentes do serviço.</p>
          </div>
          <ul className="related-grid">
            {SERVICE_PAGES.map((page) => (
              <li key={page.slug}>
                <Link href={`/${page.slug}`}>
                  <span className="related-segment">{page.segment}</span>
                  <strong>{page.heading}</strong>
                  <span className="related-arrow"><ArrowIcon /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="plans-section" id="planos">
          <div className="section-heading"><span className="eyebrow">Planos que crescem com você</span><h2>Comece grátis. Evolua<br />no seu tempo.</h2><p>Sem fidelidade. Cancele quando quiser.</p></div>
          <div className="plans-grid">
            {plans.map((plan) => (
              <article className={`plan-card ${plan.featured ? "featured" : ""}`} key={plan.name}>
                {plan.badge && <span className="plan-badge">{plan.badge}</span>}
                <h3>{plan.name}</h3><p>{plan.description}</p>
                <div className="plan-price"><strong>{plan.price}</strong><span>{plan.period}</span></div>
                <a href="#calculadora" className={plan.featured ? "primary-button wide" : "outline-button wide"}>{plan.cta}</a>
                <ul>{plan.features.map((feature) => <li key={feature}><CheckIcon /> {feature}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <section className="closing-cta">
          <div><span className="eyebrow"><ShieldIcon /> Seu negócio merece números claros</span><h2>Pronta para valorizar<br />o seu trabalho?</h2><p>Faça seu primeiro cálculo agora. É grátis e leva menos de 3 minutos.</p><a href="#calculadora" className="light-button">Calcular meu preço <ArrowIcon /></a></div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
