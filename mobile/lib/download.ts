import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Entrega de um arquivo ao dono dos dados — no aparelho.
 *
 * "Baixar um arquivo" não significa a mesma coisa nas duas plataformas, e por
 * isso este módulo tem duas metades: esta e a de `download.web.ts`, que o
 * empacotador escolhe sozinho quando o alvo é a web. Assim nenhuma tela precisa
 * perguntar em que plataforma está, e o código do sistema de arquivos nem entra
 * no pacote do navegador.
 *
 * No celular não existe pasta de downloads que a usuária alcance depois. O
 * caminho é escrever no cache do aplicativo e abrir a folha de compartilhamento
 * do sistema, que é onde ela decide o destino: guardar nos Arquivos, mandar
 * para o e-mail, subir para a nuvem. O cache é proposital — quando ela escolhe,
 * o arquivo já saiu daqui, e o que ficar para trás o sistema limpa sozinho.
 */

/** Como o arquivo chegou às mãos da usuária; muda o que a tela diz depois. */
export type FileDelivery = 'baixado' | 'compartilhado';

export type FileToDeliver = {
  filename: string;
  text: string;
  /** Título da folha do sistema, no Android. */
  dialogTitle: string;
};

export async function deliverFile({ filename, text, dialogTitle }: FileToDeliver): Promise<FileDelivery> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(
      'Este aparelho não oferece onde guardar o arquivo. Abra o BeautyConta no navegador para baixar seus dados.',
    );
  }

  const file = new File(Paths.cache, filename);
  // Uma segunda exportação no mesmo dia reencontra o arquivo da primeira; criar
  // por cima é o que garante que o conteúdo entregue seja o novo.
  file.create({ overwrite: true });
  file.write(text);

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle,
  });

  return 'compartilhado';
}
