/**
 * Entrega de um arquivo ao dono dos dados — no navegador.
 *
 * A outra metade de `download.ts`. Aqui existe pasta de downloads, e é para lá
 * que o arquivo vai: o conteúdo vira um endereço temporário na memória da aba e
 * uma âncora com `download` dispara o salvamento. Nada disso passa por servidor
 * nenhum.
 *
 * A folha de compartilhamento do sistema não serve aqui: a API de
 * compartilhamento do navegador não aceita arquivo local, exige página em HTTPS
 * e falta na maioria dos navegadores de computador — justamente onde a
 * profissional vai querer guardar a cópia.
 */

/** Como o arquivo chegou às mãos da usuária; muda o que a tela diz depois. */
export type FileDelivery = 'baixado' | 'compartilhado';

export type FileToDeliver = {
  filename: string;
  text: string;
  /** Título da folha do sistema, no Android. Sem uso no navegador. */
  dialogTitle: string;
};

export async function deliverFile({ filename, text }: FileToDeliver): Promise<FileDelivery> {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Revogar na mesma volta do laço cancelaria o download em parte dos
  // navegadores, que só começam a ler o endereço depois do clique.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);

  return 'baixado';
}
