import { CalendarIcon } from "@/components/icons";

/**
 * Link inválido **ou** agenda desligada.
 *
 * A mesma tela para os dois casos é a parte importante: a API não distingue de
 * propósito, para que o endereço não sirva de sonda. Um texto do tipo "esta
 * agenda está fechada" desfaria essa proteção, porque revelaria que o token
 * existe.
 *
 * O tom é de recado, e não de erro: quem chega aqui costuma ser a cliente com o
 * link antigo, que não errou nada.
 */
export default function BookingNotFound() {
  return (
    <main id="conteudo" className="booking-page">
      <div className="booking-shell">
        <div className="booking-gone">
          <span className="booking-done-mark muted" aria-hidden="true">
            <CalendarIcon />
          </span>
          <h1>Link indisponível</h1>
          <p>
            Este link de agendamento não está disponível. Peça um link novo para a profissional,
            por favor.
          </p>
        </div>
      </div>
    </main>
  );
}
