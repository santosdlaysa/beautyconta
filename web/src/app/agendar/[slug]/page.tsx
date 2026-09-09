import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingError, type BookingPage } from "@/application/ports/booking";
import { buildBookingCalendar } from "@/application/use-cases/booking-calendar";
import { BookingFlow } from "@/components/booking";
import { AlertIcon } from "@/components/icons";
import { bookingGateway } from "@/config/booking";

/**
 * Agenda pública: a página que a cliente abre a partir do link que a
 * profissional mandou pelo WhatsApp ou pelo Instagram.
 *
 * Nunca estática. Os horários mudam a cada minuto, e uma versão guardada
 * ofereceria vaga que já foi ocupada — o pior resultado possível aqui, porque a
 * cliente só descobriria depois de digitar tudo.
 */
export const dynamic = "force-dynamic";

/**
 * Fora do buscador e fora do `sitemap.ts`.
 *
 * O endereço é a única barreira entre a agenda e a internet: indexar a página
 * publicaria, em uma busca só, o link secreto de todas as profissionais.
 */
export const metadata: Metadata = {
  title: "Agendar horário",
  robots: { index: false, follow: false, nocache: true },
};

/** Nem toda falha é link inválido, e a tela precisa dizer coisas diferentes. */
type LoadResult =
  | { status: "ok"; page: BookingPage }
  | { status: "not_found" }
  | { status: "unavailable" };

async function loadPage(slug: string): Promise<LoadResult> {
  try {
    // Sem prazo, uma API que aceita a conexão e não responde deixaria a
    // requisição pendurada e a cliente olhando a tela em branco.
    return { status: "ok", page: await bookingGateway.page(slug, AbortSignal.timeout(8000)) };
  } catch (error) {
    if (error instanceof BookingError && error.code === "not_found") return { status: "not_found" };
    return { status: "unavailable" };
  }
}

export default async function BookingPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await loadPage(slug);

  // Link inválido e agenda desligada dão a mesma resposta, porque a API não
  // distingue os dois de propósito — e a página não pode ser a peneira que ela
  // evitou ser.
  if (result.status === "not_found") notFound();

  // API fora do ar não é link inválido. Dizer "não encontrado" aqui mandaria a
  // cliente pedir um link novo que já estava certo.
  if (result.status === "unavailable") {
    return (
      <main id="conteudo" className="booking-page">
        <div className="booking-shell">
          <div className="booking-gone">
            <span className="booking-done-mark muted" aria-hidden="true">
              <AlertIcon />
            </span>
            <h1>Não conseguimos abrir a agenda</h1>
            <p>A conexão falhou por um instante. Toque em recarregar — o link continua valendo.</p>
            <a className="primary-button" href={`/agendar/${encodeURIComponent(slug)}`}>
              Recarregar
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main id="conteudo" className="booking-page">
      <BookingFlow
        slug={slug}
        page={result.page}
        calendar={buildBookingCalendar(new Date(), result.page.timezone)}
      />
    </main>
  );
}
