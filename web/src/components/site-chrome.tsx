import Link from "next/link";
import { SERVICE_PAGES } from "@/content/service-pages";
import { BrandLogo } from "./brand";
import { MenuIcon } from "./icons";

/**
 * Cabeçalho e rodapé compartilhados.
 *
 * As páginas por intenção de busca do item C-04 precisam do mesmo enquadramento
 * da página inicial; duplicar a marcação seria a forma mais rápida de as duas
 * saírem do lugar.
 */

export function SiteHeader() {
  return (
    <header className="site-header">
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <Link href="/" className="logo" aria-label="BeautyConta, início"><BrandLogo /></Link>
      <nav aria-label="Navegação principal">
        <Link href="/#como-funciona">Como funciona</Link>
        <Link href="/#calculadoras">Calculadoras</Link>
        <Link href="/#planos">Planos</Link>
      </nav>
      <div className="header-actions">
        <button className="login-button" type="button">Entrar</button>
        <Link href="/#calculadora" className="header-cta">Calcular grátis</Link>
      </div>
      <button className="menu-button" type="button" aria-label="Abrir menu"><MenuIcon /></button>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <div className="footer-brand">
        <Link href="/" className="logo" aria-label="BeautyConta, início"><BrandLogo /></Link>
        <p>Precificação simples para quem transforma beleza em negócio.</p>
        <small>© 2026 BeautyConta</small>
      </div>
      <nav className="footer-links" aria-label="Calculadoras por serviço">
        <h2>Calculadoras</h2>
        <ul>
          {SERVICE_PAGES.map((page) => (
            <li key={page.slug}><Link href={`/${page.slug}`}>{page.heading}</Link></li>
          ))}
        </ul>
      </nav>
      <nav className="footer-links" aria-label="Institucional">
        <h2>BeautyConta</h2>
        <ul>
          <li><Link href="/#planos">Planos</Link></li>
          <li><Link href="/#como-funciona">Como funciona</Link></li>
        </ul>
      </nav>
    </footer>
  );
}
