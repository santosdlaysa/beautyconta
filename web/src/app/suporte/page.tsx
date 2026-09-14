import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import styles from "@/components/legal.module.css";

export const metadata: Metadata = {
  title: "Suporte | BeautyConta",
  description: "Fale com o suporte do BeautyConta para receber ajuda com cadastro, acesso, assinaturas e uso do aplicativo.",
  alternates: { canonical: "/suporte" },
};

export default function SupportPage() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className={styles.page}>
        <article className={styles.policy} aria-labelledby="support-title">
          <header className={styles.heading}>
            <span className="eyebrow">BeautyConta · Estamos aqui para ajudar</span>
            <h1 id="support-title">Suporte BeautyConta</h1>
            <p>O BeautyConta é um aplicativo de precificação e gestão para profissionais da beleza. Fale com nossa equipe para tirar dúvidas ou resolver problemas com sua conta e o aplicativo.</p>
          </header>
          <section aria-labelledby="contato">
            <h2 id="contato">Fale com o suporte</h2>
            <p>WhatsApp: <a href="https://wa.me/5595991371313">+55 (95) 99137-1313</a>.</p>
            <p>E-mail: <a href="mailto:santosdlaysa@gmail.com">santosdlaysa@gmail.com</a>.</p>
            <p>Você não precisa entrar na conta para pedir ajuda.</p>
          </section>
          <section aria-labelledby="acesso">
            <h2 id="acesso">Problemas com cadastro ou login?</h2>
            <p>Informe o modelo do aparelho, a versão do sistema e do aplicativo, a mensagem de erro e em qual etapa ela aparece. Se possível, envie uma captura da tela sem dados pessoais. Nunca envie sua senha ou dados de pagamento.</p>
          </section>
          <section aria-labelledby="assinaturas">
            <h2 id="assinaturas">Assinaturas e compras</h2>
            <p>Para recuperar uma compra, entre na sua conta e use a opção de restaurar compras na tela de planos. Assinaturas compradas pela App Store podem ser gerenciadas nos Ajustes do iPhone ou iPad, em seu nome → Assinaturas.</p>
            <p>Se precisar de ajuda com uma cobrança ou com o acesso ao plano, fale com nossa equipe pelos contatos acima.</p>
          </section>
          <section aria-labelledby="privacidade">
            <h2 id="privacidade">Sua conta e seus dados</h2>
            <ul>
              <li><Link href="/privacidade">Política de Privacidade</Link></li>
              <li><Link href="/termos">Termos de Uso</Link></li>
              <li><Link href="/excluir-conta">Solicitar exclusão da conta e dos dados</Link></li>
            </ul>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
