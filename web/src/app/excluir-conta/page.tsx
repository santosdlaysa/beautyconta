import type { Metadata } from "next";
import Link from "next/link";
import { AccountDeletionForm } from "@/components/account-deletion";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import styles from "@/components/legal.module.css";

export const metadata: Metadata = {
  title: "Excluir conta e dados | BeautyConta",
  description:
    "Peça a exclusão da sua conta do BeautyConta e de todos os dados vinculados a ela.",
  alternates: { canonical: "/excluir-conta" },
  openGraph: { title: "Excluir conta e dados | BeautyConta", url: "/excluir-conta" },
};

export default function AccountDeletionPage() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className={styles.page}>
        <article className={styles.policy} aria-labelledby="delete-title">
          <header className={styles.heading}>
            <span className="eyebrow">BeautyConta · Seus dados</span>
            <h1 id="delete-title">Excluir conta e dados</h1>
            <p>
              Você pode apagar sua conta do BeautyConta e tudo o que cadastrou nela. A exclusão é
              definitiva e não dá para desfazer.
            </p>
          </header>

          <section aria-labelledby="pelo-app">
            <h2 id="pelo-app">O jeito mais rápido: pelo aplicativo</h2>
            <p>
              Se você ainda consegue entrar, a exclusão acontece na hora e não depende de resposta de
              ninguém. No aplicativo, abra o <strong>Perfil</strong> e toque em{" "}
              <strong>Excluir minha conta</strong>.
            </p>
            <p>
              Antes de apagar, vale usar <strong>Exportar meus dados</strong> para guardar uma cópia
              dos seus cálculos, materiais e custos — depois da exclusão não há como recuperar.
            </p>
          </section>

          <section aria-labelledby="o-que-apaga">
            <h2 id="o-que-apaga">O que é apagado</h2>
            <p>Sai tudo o que está ligado à sua conta:</p>
            <ul>
              <li>Seu cadastro: nome, e-mail e senha.</li>
              <li>Seus negócios, com configurações, metas e horários de atendimento.</li>
              <li>Materiais, custos fixos, equipamentos e serviços.</li>
              <li>Todo o histórico de cálculos de preço.</li>
              <li>Agendamentos recebidos pelo link público, com os dados das clientes.</li>
              <li>Sua agenda pública, que deixa de existir no endereço em que estava.</li>
            </ul>
            <p>
              Registros de cobrança podem ser mantidos pelo prazo que a lei exige, e cópias de
              segurança são substituídas dentro do ciclo normal delas. A{" "}
              <Link href="/privacidade">Política de Privacidade</Link> explica esses casos.
            </p>
          </section>

          <section aria-labelledby="assinatura">
            <h2 id="assinatura">Se você tem assinatura</h2>
            <p>
              <strong>Apagar a conta não cancela sozinho uma assinatura comprada em loja.</strong>{" "}
              Cancele também nas assinaturas da sua conta da App Store ou do Google Play — a Apple e
              o Google não permitem que o aplicativo faça isso por você, e a cobrança continuaria
              vindo.
            </p>
          </section>

          <section aria-labelledby="formulario">
            <h2 id="formulario">Não consegue entrar? Peça por aqui</h2>
            <p>
              Se você desinstalou o aplicativo, perdeu a senha ou trocou de aparelho, preencha o
              formulário. Vamos confirmar que o pedido é seu antes de apagar — essa conferência
              protege sua conta de ser apagada por outra pessoa.
            </p>

            <AccountDeletionForm />

            <p>
              Prefere escrever? Mande um e-mail para{" "}
              <a href="mailto:suporte@beautyconta.com.br">suporte@beautyconta.com.br</a> do endereço
              cadastrado. <strong>Nunca envie sua senha.</strong>
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
