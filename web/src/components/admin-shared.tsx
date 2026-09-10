"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AdminAuthError } from "@/infrastructure/admin/gateway";

/**
 * Peças usadas por mais de uma tela do painel.
 *
 * Ficam aqui para que a tela principal e as de leitura compartilhem o mesmo
 * cartão e a mesma tabela — duas versões do mesmo cartão viram dois visuais
 * diferentes na primeira vez que alguém mexer num deles.
 */

/**
 * Carrega dados da API e cuida do 401 de forma uniforme.
 *
 * O 401 tem tratamento próprio porque é o único erro que significa "entre de
 * novo": mostrá-lo como erro comum deixaria a pessoa olhando uma mensagem
 * técnica num painel que já não responde.
 */
export function useAdminData<T>(
  carregar: () => Promise<T>,
  onExpirar: () => void,
  /** O que, além do pedido explícito de recarga, deve buscar de novo. */
  deps: unknown[] = [],
) {
  const [data, setData] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;

    carregar()
      .then((resultado) => {
        if (ativo) setData(resultado);
      })
      .catch((falha: unknown) => {
        if (!ativo) return;
        if (falha instanceof AdminAuthError) {
          onExpirar();
          return;
        }
        setErro((falha as Error).message);
      });

    return () => {
      ativo = false;
    };
    // `carregar` muda a cada render por ser uma closure; a versão é o gatilho
    // explícito de recarga, e depender dela evita o laço infinito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versao, ...deps]);

  return { data, erro, recarregar: () => setVersao((v) => v + 1) };
}

export function AdminCard({
  titulo,
  valor,
  nota,
  tom,
}: {
  titulo: string;
  valor: string;
  nota?: string;
  /** `alerta` marca o número que pede ação, e não só informa. */
  tom?: "alerta";
}) {
  return (
    <div className="admin-card" data-tom={tom}>
      <span className="admin-card-titulo">{titulo}</span>
      <strong className="admin-card-valor">{valor}</strong>
      {nota && <span className="admin-card-nota">{nota}</span>}
    </div>
  );
}

/**
 * Tabela do painel.
 *
 * O contêiner com rolagem própria é o que impede uma tabela larga de empurrar a
 * página inteira para o lado no celular.
 */
export function AdminTable({
  legenda,
  colunas,
  children,
}: {
  legenda: string;
  colunas: string[];
  children: ReactNode;
}) {
  return (
    <div className="admin-tabela-wrap">
      <table className="admin-tabela">
        <caption>{legenda}</caption>
        <thead>
          <tr>
            {colunas.map((coluna) => (
              <th key={coluna} scope="col">
                {coluna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
