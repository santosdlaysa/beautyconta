import type { Metadata } from "next";
import { AdminPanel } from "@/components/admin-panel";

/**
 * Painel administrativo.
 *
 * `noindex` porque esta página não é conteúdo: aparecer em buscador só levaria
 * gente à tela de segredo, e o endereço de um painel é informação que não
 * precisa circular.
 */
export const metadata: Metadata = {
  title: "Painel | BeautyConta",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminPanel />;
}
