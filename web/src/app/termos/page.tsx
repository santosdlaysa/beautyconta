import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import styles from "@/components/legal.module.css";

export const metadata: Metadata = {
  title: "Termos de Uso | BeautyConta",
  description:
    "Condições de uso do BeautyConta, incluindo assinaturas, renovação automática, cancelamento e responsabilidades.",
  alternates: { canonical: "/termos" },
  openGraph: { title: "Termos de Uso | BeautyConta", url: "/termos" },
};

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className={styles.page}>
        <article className={styles.policy} aria-labelledby="terms-title">
          <header className={styles.heading}>
            <span className="eyebrow">BeautyConta · Condições</span>
            <h1 id="terms-title">Termos de Uso</h1>
            <p>Estes termos regem o uso do aplicativo BeautyConta, do site e das páginas públicas de agendamento. Ao criar uma conta ou usar o serviço, você concorda com o que está escrito aqui.</p>
            <p className={styles.updated}>Última atualização: <time dateTime="2026-09-10">10 de setembro de 2026</time>.</p>
          </header>

          <section aria-labelledby="servico">
            <h2 id="servico">1. O que o BeautyConta faz</h2>
            <p>O BeautyConta é uma ferramenta de precificação e gestão para profissionais autônomas da beleza. Ele calcula preços a partir das informações que você cadastra — materiais, custos fixos, equipamentos, duração dos serviços e a retirada que deseja — e organiza cadastros, histórico de cálculos e agendamentos.</p>
            <p><strong>O cálculo é uma sugestão, não uma recomendação financeira ou contábil.</strong> O resultado depende inteiramente dos dados que você informa, e a decisão sobre quanto cobrar é sua. O BeautyConta não presta consultoria contábil, tributária ou de investimentos, e não garante lucro, faturamento ou qualquer resultado do seu negócio.</p>
          </section>

          <section aria-labelledby="conta">
            <h2 id="conta">2. Sua conta</h2>
            <p>Para usar a maior parte do serviço é preciso criar uma conta com e-mail e senha. Você é responsável por manter sua senha protegida e pelas ações realizadas na sua conta. Avise-nos se identificar acesso indevido.</p>
            <p>O serviço é destinado a maiores de 18 anos que atuem profissionalmente ou pretendam atuar. Você declara que as informações de cadastro são verdadeiras.</p>
            <p>A calculadora pública do site funciona sem cadastro e continuará disponível gratuitamente.</p>
          </section>

          <section aria-labelledby="planos">
            <h2 id="planos">3. Plano gratuito e planos pagos</h2>
            <p>O BeautyConta tem um plano gratuito com limites de cadastro e um ou mais planos pagos por assinatura. Os limites de cada plano são exibidos no aplicativo, na tela de planos, e aplicados pelo servidor.</p>
            <p><strong>Atingir um limite nunca apaga o que você já cadastrou.</strong> O que acontece é que novos cadastros daquele tipo deixam de ser aceitos até que você assine ou remova registros. Se uma assinatura terminar, o acesso volta ao plano gratuito e seus dados continuam salvos — apenas os recursos exclusivos do plano pago deixam de estar disponíveis.</p>
          </section>

          <section aria-labelledby="assinatura">
            <h2 id="assinatura">4. Assinaturas, renovação e preço</h2>
            <p>As assinaturas são vendidas por período — mensal ou anual, conforme as opções exibidas no momento da compra. O preço, a moeda e o período aparecem na tela de planos antes da confirmação.</p>
            <p><strong>A assinatura é renovada automaticamente</strong> ao fim de cada período, pelo preço vigente do mesmo plano, até que seja cancelada. A cobrança da renovação ocorre no canal em que a assinatura foi contratada.</p>
            <p>Quando a compra é feita dentro do aplicativo em um aparelho Apple ou Android, ela é processada pela App Store ou pelo Google Play, e o valor cobrado é o exibido pela loja, na moeda do país da sua conta. A cobrança da renovação é feita pela loja nas condições dela.</p>
            <p>Podemos alterar os preços. Alterações não afetam o período já pago, e a nova condição passa a valer na renovação seguinte, com aviso prévio pelos meios de contato disponíveis. Se você não concordar, pode cancelar antes da renovação.</p>
          </section>

          <section aria-labelledby="cancelamento">
            <h2 id="cancelamento">5. Cancelamento e reembolso</h2>
            <p><strong>Você pode cancelar quando quiser, sem multa.</strong> O cancelamento interrompe as renovações futuras; o acesso ao plano pago segue até o fim do período já pago, e depois a conta volta ao plano gratuito.</p>
            <p>O cancelamento deve ser feito no mesmo canal em que a assinatura foi contratada:</p>
            <ul>
              <li><strong>Compra pelo site:</strong> pela tela de planos do aplicativo ou pelo contato de suporte.</li>
              <li><strong>Compra pelo iPhone ou iPad:</strong> nas assinaturas da sua conta da App Store. A Apple não permite que o aplicativo cancele a compra por você.</li>
              <li><strong>Compra pelo Android:</strong> nas assinaturas da sua conta do Google Play, pelo mesmo motivo.</li>
            </ul>
            <p>Pedidos de reembolso de compras feitas nas lojas seguem as políticas da Apple e do Google, que decidem sobre eles. Para compras feitas pelo site, aplica-se a legislação brasileira, incluindo o direito de arrependimento em até 7 dias da contratação previsto no Código de Defesa do Consumidor.</p>
            <p>A exclusão da conta não cancela sozinha uma assinatura contratada em uma loja: cancele também no canal correspondente.</p>
          </section>

          <section aria-labelledby="uso">
            <h2 id="uso">6. Uso aceitável</h2>
            <p>Ao usar o BeautyConta, você concorda em não: usar o serviço para fins ilícitos; tentar obter acesso a dados de outras usuárias; sobrecarregar, sondar ou contornar os limites e proteções do serviço; copiar, revender ou redistribuir o serviço; ou enviar conteúdo que viole direitos de terceiros.</p>
            <p>Ao cadastrar informações de clientes ou receber agendamentos, você é responsável por usar esses dados de forma adequada e legal no seu negócio, conforme descrito na <Link href="/privacidade">Política de Privacidade</Link>.</p>
          </section>

          <section aria-labelledby="conteudo">
            <h2 id="conteudo">7. Seus dados e sua propriedade</h2>
            <p>Os dados que você cadastra continuam seus. Nós os tratamos para prestar o serviço, conforme a <Link href="/privacidade">Política de Privacidade</Link>.</p>
            <p>Você pode obter uma cópia dos seus dados a qualquer momento pela opção <strong>Exportar meus dados</strong>, e pode remover sua conta pela opção <strong>Excluir minha conta</strong>. A exclusão é irreversível.</p>
            <p>A marca, o design, o código e os textos do BeautyConta pertencem ao serviço e não podem ser usados sem autorização.</p>
          </section>

          <section aria-labelledby="disponibilidade">
            <h2 id="disponibilidade">8. Disponibilidade e alterações do serviço</h2>
            <p>Trabalhamos para manter o serviço disponível, mas ele pode passar por manutenções, interrupções e falhas. Podemos alterar, adicionar ou descontinuar funcionalidades. Se uma mudança relevante reduzir o que um plano pago entrega, avisaremos com antecedência razoável.</p>
            <p>Podemos suspender ou encerrar contas que violem estes termos ou a lei, preservando, quando possível, seu direito de obter uma cópia dos dados.</p>
          </section>

          <section aria-labelledby="responsabilidade">
            <h2 id="responsabilidade">9. Responsabilidade</h2>
            <p>O BeautyConta é fornecido como uma ferramenta de apoio. Não respondemos por decisões comerciais tomadas com base nos cálculos, por prejuízos decorrentes de dados incorretos informados por você, nem por indisponibilidade de serviços de terceiros, como processadores de pagamento e lojas de aplicativos.</p>
            <p>Nada nestes termos afasta os direitos que a legislação brasileira, em especial o Código de Defesa do Consumidor, garante a você de forma irrenunciável.</p>
          </section>

          <section aria-labelledby="alteracoes-termos">
            <h2 id="alteracoes-termos">10. Alterações destes termos</h2>
            <p>Estes termos podem ser atualizados para refletir mudanças no serviço ou na legislação. A versão vigente fica sempre nesta página, com a data da última atualização. Mudanças relevantes serão comunicadas pelos meios de contato disponíveis. Continuar usando o serviço após a atualização significa concordar com a nova versão.</p>
          </section>

          <section aria-labelledby="foro">
            <h2 id="foro">11. Lei aplicável e contato</h2>
            <p>Estes termos são regidos pela lei brasileira. Fica eleito o foro do domicílio da consumidora para dirimir controvérsias, conforme o Código de Defesa do Consumidor.</p>
            <p>Dúvidas sobre estes termos: <a href="mailto:suporte@beautyconta.com.br">suporte@beautyconta.com.br</a>.</p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
