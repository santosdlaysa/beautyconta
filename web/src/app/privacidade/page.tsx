import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import styles from "@/components/legal.module.css";

export const metadata: Metadata = {
  title: "Política de Privacidade | BeautyConta",
  description: "Saiba como o BeautyConta trata seus dados pessoais e como solicitar acesso, correção ou exclusão.",
  alternates: { canonical: "/privacidade" },
  openGraph: { title: "Política de Privacidade | BeautyConta", url: "/privacidade" },
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className={styles.page}>
        <article className={styles.policy} aria-labelledby="privacy-title">
          <header className={styles.heading}>
            <span className="eyebrow">BeautyConta · Seus dados</span>
            <h1 id="privacy-title">Política de Privacidade</h1>
            <p>Esta política explica como os dados pessoais são tratados no aplicativo BeautyConta, no site e nas páginas públicas de agendamento.</p>
            <p className={styles.updated}>Última atualização: <time dateTime="2026-09-10">10 de setembro de 2026</time>.</p>
          </header>

          <section aria-labelledby="responsavel">
            <h2 id="responsavel">1. Quem trata seus dados</h2>
            <p>O BeautyConta é um serviço de precificação e gestão para profissionais da beleza. A equipe responsável pelo serviço atende dúvidas e solicitações sobre privacidade pelo e-mail <a href="mailto:suporte@beautyconta.com.br">suporte@beautyconta.com.br</a>.</p>
            <p>Quando uma profissional registra informações de suas clientes ou recebe um agendamento, ela também é responsável pelo uso desses dados no atendimento e em seu negócio. O BeautyConta fornece a estrutura para armazenar e organizar essas informações.</p>
          </section>

          <section aria-labelledby="dados">
            <h2 id="dados">2. Quais dados são tratados</h2>
            <ul>
              <li><strong>Conta:</strong> nome, e-mail, senha protegida por uma função de derivação e registros de sessão para autenticação.</li>
              <li><strong>Negócio:</strong> nome, segmento, modelo de trabalho, fuso horário, configurações, materiais, custos, equipamentos, serviços, preços, metas e histórico de cálculos que você salva.</li>
              <li><strong>Agendamentos:</strong> nome e telefone da cliente, serviço escolhido, data, horário, valores, situação do atendimento e observações informadas.</li>
              <li><strong>Assinaturas, quando utilizadas:</strong> plano, situação da assinatura, identificadores e eventos de compra recebidos do canal de cobrança.</li>
              <li><strong>Uso técnico e suporte:</strong> informações necessárias para atender requisições e proteger o serviço, como endereço IP, registros de erros e dados que você envia ao entrar em contato.</li>
            </ul>
            <p>A calculadora pública do site funciona sem cadastro e realiza o cálculo no navegador. No aplicativo, informações de sessão e cálculos pendentes podem ser armazenados no aparelho para permitir a continuidade do uso.</p>
            <p>Evite inserir dados de saúde ou outras informações sensíveis nos campos de observações. Cadastre informações de clientes apenas quando tiver autorização ou outra justificativa legal para isso.</p>
          </section>

          <section aria-labelledby="finalidades">
            <h2 id="finalidades">3. Para que usamos as informações</h2>
            <p>Usamos os dados para criar e autenticar sua conta, salvar e disponibilizar seus cadastros, calcular preços, organizar agendamentos, administrar o acesso aos planos e prestar suporte. Também podemos tratar informações para prevenir abuso, investigar falhas e cumprir obrigações legais.</p>
            <p>Conforme a finalidade, o tratamento se apoia na execução do serviço solicitado, no cumprimento de obrigações legais ou no interesse legítimo de manter o serviço seguro, respeitados seus direitos. Quando uma atividade depender de consentimento, ele deverá ser solicitado de forma específica e poderá ser revogado.</p>
          </section>

          <section aria-labelledby="compartilhamento">
            <h2 id="compartilhamento">4. Com quem os dados podem ser compartilhados</h2>
            <p>As informações são processadas pela infraestrutura de hospedagem e banco de dados usada pelo BeautyConta. O acesso pela equipe se destina à operação e ao suporte do serviço.</p>
            <ul>
              <li><strong>Profissional escolhida:</strong> os dados enviados em um agendamento ficam disponíveis para o negócio responsável pelo atendimento. Informações do negócio, serviços e horários disponibilizados no link público podem ser consultados por quem acessar esse link.</li>
              <li><strong>Cobrança:</strong> quando o canal correspondente estiver disponível e for utilizado, Mercado Pago, RevenueCat e as lojas Apple App Store ou Google Play podem processar informações necessárias à compra e à gestão da assinatura, conforme suas próprias políticas.</li>
              <li><strong>Alertas operacionais:</strong> quando habilitados, usamos o Telegram para avisar a equipe sobre novos cadastros, assinaturas e falhas. Esses avisos podem conter nome e e-mail de cadastro, nome do negócio, informações do plano e detalhes técnicos do erro.</li>
              <li><strong>Obrigações legais:</strong> informações podem ser fornecidas quando exigidas por lei ou por determinação de autoridade competente.</li>
            </ul>
            <p>Alguns fornecedores podem processar dados fora do Brasil. O tratamento deve observar as exigências aplicáveis de proteção de dados e de transferência internacional.</p>
          </section>

          <section aria-labelledby="armazenamento-local">
            <h2 id="armazenamento-local">5. Armazenamento no aparelho e métricas</h2>
            <p>O aplicativo utiliza armazenamento local para manter a sessão e recuperar informações pendentes. Sair da conta remove a sessão local; desinstalar o aplicativo não exclui a conta nem os dados salvos no servidor.</p>
            <p>Na versão atual, a instrumentação de métricas de uso do BeautyConta não envia eventos a uma plataforma de analytics em produção. Caso sejam adicionadas ferramentas que alterem o tratamento de dados, esta política será atualizada e as escolhas necessárias serão apresentadas.</p>
          </section>

          <section aria-labelledby="seguranca">
            <h2 id="seguranca">6. Segurança e conservação</h2>
            <p>Adotamos medidas como proteção de senhas, autenticação de sessões, controle de acesso por negócio e limites de requisições. Nenhum sistema é totalmente imune a incidentes; mantenha suas credenciais protegidas e entre em contato se identificar acesso indevido.</p>
            <p>Os dados de conta e de negócio são mantidos enquanto necessários para prestar o serviço. A exclusão da conta remove os cadastros vinculados do banco principal. Registros de cobrança, registros técnicos, cópias de segurança e informações já processadas por fornecedores podem ter conservação distinta, conforme a finalidade e obrigações aplicáveis. Você pode solicitar esclarecimentos sobre esses registros pelo contato desta política.</p>
          </section>

          <section aria-labelledby="direitos">
            <h2 id="direitos">7. Seus direitos e como excluir seus dados</h2>
            <p>Você pode solicitar confirmação de tratamento, acesso, correção, informações sobre compartilhamento, portabilidade quando aplicável e exclusão de dados, além de exercer os demais direitos previstos na Lei Geral de Proteção de Dados (LGPD). Quando o tratamento depender de consentimento, você pode solicitar sua revogação.</p>
            <p>No aplicativo, acesse a área de perfil e use <strong>Exportar meus dados</strong> para obter uma cópia ou <strong>Excluir minha conta</strong> para remover sua conta e os dados vinculados. A exclusão é irreversível. A gestão ou o cancelamento de uma assinatura deve ser feito também no canal em que ela foi contratada.</p>
            <p>Se não conseguir acessar sua conta, envie a solicitação para <a href="mailto:suporte@beautyconta.com.br">suporte@beautyconta.com.br</a>. Podemos pedir informações para confirmar sua identidade antes de fornecer ou excluir dados. Não envie sua senha.</p>
            <p>Se você agendou um atendimento como cliente, pode procurar a profissional responsável ou entrar em contato conosco para esclarecer o tratamento das suas informações no BeautyConta.</p>
          </section>

          <section aria-labelledby="menores">
            <h2 id="menores">8. Crianças e adolescentes</h2>
            <p>O BeautyConta é destinado à gestão de atividades profissionais e não é direcionado a crianças. Se identificar informações de uma criança fornecidas indevidamente, entre em contato para que a situação seja analisada e sejam tomadas as medidas cabíveis.</p>
          </section>

          <section aria-labelledby="alteracoes">
            <h2 id="alteracoes">9. Alterações e contato</h2>
            <p>Esta política pode ser atualizada para refletir mudanças no serviço e no tratamento de dados. A versão vigente ficará disponível nesta página, com a data da última atualização. Mudanças que exijam aviso ou consentimento serão comunicadas pelos meios apropriados.</p>
            <p>Para assuntos de privacidade, escreva para <a href="mailto:suporte@beautyconta.com.br">suporte@beautyconta.com.br</a>.</p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
