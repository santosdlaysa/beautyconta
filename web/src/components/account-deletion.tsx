"use client";

import { useState, type FormEvent } from "react";
import { API_URL } from "@/config/api";

/**
 * Pedido de exclusão de conta pelo site.
 *
 * Esta página existe para quem **não consegue entrar** — desinstalou, esqueceu a
 * senha, trocou de aparelho. Quem ainda entra apaga a própria conta na hora, e o
 * texto diz isso primeiro: é o caminho mais rápido, e ninguém precisa esperar
 * resposta de ninguém.
 *
 * Apple e Google exigem um endereço público como este em todo aplicativo que
 * cria conta.
 */
export function AccountDeletionForm() {
  const [email, setEmail] = useState("");
  const [motivo, setMotivo] = useState("");
  const [estado, setEstado] = useState<"parado" | "enviando" | "enviado">("parado");
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    if (estado === "enviando") return;

    setEstado("enviando");
    setErro(null);

    try {
      const response = await fetch(`${API_URL}/api/account-deletion-requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, ...(motivo.trim() ? { note: motivo.trim() } : {}) }),
      });

      if (!response.ok) {
        const corpo = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(corpo?.message ?? "Não foi possível enviar agora. Tente de novo.");
      }

      setEstado("enviado");
    } catch (falha) {
      setErro((falha as Error).message);
      setEstado("parado");
    }
  };

  if (estado === "enviado") {
    return (
      <div className="delete-ok" role="status">
        <h2>Pedido recebido</h2>
        <p>
          Vamos escrever para <strong>{email}</strong> para confirmar que o pedido é seu antes de
          apagar qualquer coisa. Essa conferência existe para proteger sua conta: sem ela, qualquer
          pessoa poderia pedir a exclusão dos seus dados.
        </p>
        <p>
          Se você ainda consegue entrar no aplicativo, a exclusão por lá é imediata e não depende de
          resposta nenhuma.
        </p>
      </div>
    );
  }

  return (
    <form className="delete-form" onSubmit={enviar}>
      <div className="field">
        <label htmlFor="delete-email">E-mail da conta</label>
        <input
          id="delete-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@exemplo.com"
          autoComplete="email"
        />
        <small className="field-hint">Use o mesmo e-mail com que você criou a conta.</small>
      </div>

      <div className="field">
        <label htmlFor="delete-note">Quer contar o motivo? (opcional)</label>
        <textarea
          id="delete-note"
          rows={3}
          value={motivo}
          onChange={(event) => setMotivo(event.target.value)}
          placeholder="Não consigo mais entrar no aplicativo"
        />
      </div>

      {erro && <p className="delete-erro">{erro}</p>}

      <button type="submit" className="delete-submit" disabled={estado === "enviando"}>
        {estado === "enviando" ? "Enviando…" : "Solicitar exclusão"}
      </button>

      {/* Dito antes do envio, e não depois: quem lê isto aqui talvez descubra
          que não precisa esperar por ninguém. */}
      <p className="delete-nota">
        Não enviamos e-mail de propaganda a partir deste formulário. O endereço serve só para
        confirmar que o pedido é seu.
      </p>
    </form>
  );
}
