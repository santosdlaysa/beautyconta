import { PricingCalculator } from "@/presentation/web/calculator";
import { ArrowIcon, CalculatorIcon, ChartIcon, CheckIcon, MenuIcon, ShieldIcon, SparkleIcon } from "@/presentation/web/icons";

const plans = [
  {
    name: "Gratuito",
    description: "Para descobrir se você está cobrando certo.",
    price: "R$ 0",
    period: "para sempre",
    features: ["Calculadora completa", "Até 3 serviços", "Até 10 materiais", "Até 5 custos fixos", "5 cálculos no histórico"],
    cta: "Começar grátis",
  },
  {
    name: "Premium",
    badge: "Mais escolhido",
    description: "Para organizar preços e crescer com segurança.",
    price: "R$ 14,90",
    period: "/mês",
    features: ["Serviços e materiais ilimitados", "Custos e taxas detalhados", "Metas e histórico completo", "Tabela de preços compartilhável", "Clientes e financeiro em breve"],
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
    <main>
      <header className="site-header">
        <a href="#inicio" className="logo" aria-label="BeautyConta, início"><span>B</span>BeautyConta</a>
        <nav aria-label="Navegação principal">
          <a href="#como-funciona">Como funciona</a>
          <a href="#calculadora">Calculadora</a>
          <a href="#planos">Planos</a>
        </nav>
        <div className="header-actions">
          <button className="login-button">Entrar</button>
          <a href="#calculadora" className="header-cta">Calcular grátis</a>
        </div>
        <button className="menu-button" aria-label="Abrir menu"><MenuIcon /></button>
      </header>

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
            <div className="phone-top"><div className="mini-logo">B</div><span>Seu preço ideal</span><span className="dots">•••</span></div>
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
          <article><span className="step-number">01</span><div className="icon-box"><CalculatorIcon /></div><h3>Conte seus custos</h3><p>Informe materiais, tempo de atendimento e despesas mensais.</p></article>
          <article><span className="step-number">02</span><div className="icon-box"><ChartIcon /></div><h3>A gente faz a conta</h3><p>A fórmula considera sua mão de obra, estrutura e margem desejada.</p></article>
          <article><span className="step-number">03</span><div className="icon-box"><SparkleIcon /></div><h3>Cobre com confiança</h3><p>Veja o preço sugerido, seu lucro e simule outras possibilidades.</p></article>
        </div>
      </section>

      <section className="calculator-section"><PricingCalculator /></section>

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

      <footer><a href="#inicio" className="logo"><span>B</span>BeautyConta</a><p>Precificação simples para quem transforma beleza em negócio.</p><div><a href="#planos">Planos</a><a href="#">Privacidade</a><a href="#">Termos</a></div><small>© 2026 BeautyConta</small></footer>
    </main>
  );
}
