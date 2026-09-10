import { colors } from '../theme';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { jaViu, marcarVisto } from '../lib/jaVisto';
import {
  guiaCumprido,
  passosConcluidos,
  passosEssenciais,
  primeirosPassos,
  type Passo,
  type RotaDoPasso,
} from '../lib/primeirosPassos';
import { useApp } from '../state/AppProvider';
import { useDialog } from './Dialog';
import { Icon } from './AppChrome';
import { Badge, Card, ProgressBar, ui } from './ui';

/**
 * Primeiros passos, o tutorial de quem acabou de configurar o negócio.
 *
 * O porquê do formato está em `lib/primeirosPassos.ts`. O que este arquivo
 * garante é a parte que importa para quem usa: o cartão mora dentro da Home,
 * rola junto com ela e não cobre nada — fechar é um toque, não trava a
 * navegação e não desfaz nem perde nada do que a pessoa já cadastrou.
 */

export type GuiaDePrimeirosPassos = {
  visivel: boolean;
  passos: Passo[];
  concluidos: number;
  /** Só os essenciais entram na conta: é por eles que a lista some. */
  total: number;
  fechar: () => void;
};

/**
 * Estado do guia.
 *
 * Fica separado do cartão porque a Home precisa saber se ele está na tela: o
 * aviso "cadastre seu primeiro serviço" diz a mesma coisa, e duas cobranças
 * lado a lado na mesma tela cansam sem ensinar nada.
 */
export function usePrimeirosPassos(): GuiaDePrimeirosPassos {
  const app = useApp();
  const dialog = useDialog();
  /** `null` enquanto a leitura do aparelho não voltou; assim ele não pisca. */
  const [aberto, setAberto] = useState<boolean | null>(null);

  const estado = useMemo(() => ({
    calculos: app.calculations.length,
    materiais: app.materials.length,
    custosFixos: app.fixedCosts.length,
    temLinkDeAgenda: app.business?.bookingSlug != null,
  }), [app.calculations.length, app.materials.length, app.fixedCosts.length, app.business?.bookingSlug]);

  const passos = useMemo(() => primeirosPassos(estado), [estado]);
  const cumprido = guiaCumprido(estado);

  useEffect(() => {
    let vivo = true;
    void jaViu('primeiros-passos').then((visto) => {
      if (vivo) setAberto(!visto);
    });
    return () => { vivo = false; };
  }, []);

  // Cumprir a lista é o fim dela: some da Home e não volta em outra abertura.
  useEffect(() => {
    if (aberto === true && cumprido) {
      void marcarVisto('primeiros-passos');
      setAberto(false);
    }
  }, [aberto, cumprido]);

  const fechar = () => dialog.confirm({
    title: 'Fechar os primeiros passos?',
    message: 'Esta lista não volta. Nada do que você já fez se perde, e os mesmos caminhos continuam na Home e nas abas de baixo.',
    confirmLabel: 'Fechar',
    cancelLabel: 'Manter na tela',
    onConfirm: () => {
      void marcarVisto('primeiros-passos');
      setAberto(false);
    },
  });

  const essenciais = passosEssenciais(passos);

  return {
    visivel: aberto === true && !cumprido,
    passos,
    concluidos: passosConcluidos(essenciais),
    total: essenciais.length,
    fechar,
  };
}

export function PrimeirosPassosCard({ guia, onNavigate }: { guia: GuiaDePrimeirosPassos; onNavigate: (rota: RotaDoPasso) => void }) {
  return <Card tone="lilac">
    <View style={s.cabecalho}>
      <View style={ui.grow}>
        <Text accessibilityRole="header" style={s.titulo}>Primeiros passos</Text>
        <Text style={s.legenda}>{guia.concluidos} de {guia.total} prontos · é o que faz o preço usar os seus números</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fechar os primeiros passos"
        onPress={guia.fechar}
        style={({ pressed }) => [ui.sheetClose, pressed && ui.pressed]}
      >
        <Icon name="plus" size={18} color={colors.muted} />
      </Pressable>
    </View>

    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`${guia.concluidos} de ${guia.total} primeiros passos concluídos`}
      accessibilityValue={{ min: 0, max: guia.total, now: guia.concluidos }}
    >
      <ProgressBar value={(guia.concluidos / Math.max(guia.total, 1)) * 100} />
    </View>

    {guia.passos.map((passo) => (
      <Pressable
        key={passo.id}
        accessibilityRole="button"
        accessibilityLabel={passo.concluido
          ? `${passo.titulo}. Já feito. Abrir ${passo.tela}.`
          : `${passo.titulo}. ${passo.motivo} Abrir ${passo.tela}.`}
        onPress={() => onNavigate(passo.rota)}
        style={({ pressed }) => [s.passo, pressed && ui.pressed]}
      >
        {/* A marca não é só cor: o ícone muda para o visto quando o passo fecha. */}
        <View style={[s.marca, passo.concluido && s.marcaFeita]}>
          <Icon name={passo.concluido ? 'check' : passo.icone} size={17} color={passo.concluido ? colors.success : colors.info} />
        </View>
        <View style={ui.grow}>
          <Text style={s.passoTitulo}>{passo.titulo}</Text>
          <Text style={s.passoMotivo}>{passo.concluido ? `Feito. Fica em ${passo.tela}.` : passo.motivo}</Text>
        </View>
        {passo.opcional && !passo.concluido && <Badge label="opcional" tone="lilac" />}
        <Icon name="chevron" size={14} color={colors.outline} />
      </Pressable>
    ))}

    <Text style={s.rodape}>Esta lista sai da tela sozinha quando os passos essenciais estiverem prontos.</Text>
  </Card>;
}

const s = StyleSheet.create({
  cabecalho: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titulo: { color: colors.ink, fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
  legenda: { color: colors.ink3, fontSize: 11, lineHeight: 17, marginTop: 4 },

  passo: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 56, borderRadius: 16, backgroundColor: colors.white, paddingHorizontal: 11, paddingVertical: 9 },
  marca: { width: 34, height: 34, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softLilac },
  marcaFeita: { backgroundColor: colors.successSoft },
  passoTitulo: { color: colors.ink2, fontSize: 13, fontWeight: '600' },
  passoMotivo: { color: colors.ink3, fontSize: 11, lineHeight: 16, marginTop: 3 },

  rodape: { color: colors.faded, fontSize: 10, lineHeight: 15 },
});
