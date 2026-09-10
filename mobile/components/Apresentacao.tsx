import { colors } from '../theme';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SLIDES_DA_APRESENTACAO, indiceDaRolagem } from '../lib/apresentacao';
import { Brand } from './AuthScreens';
import { Button, IconBubble, ui } from './ui';

/**
 * Apresentação da primeira abertura.
 *
 * Não confundir com o onboarding de cinco etapas (`OnboardingScreens.tsx`), que
 * acontece depois do cadastro: aqui ainda não existe conta nenhuma.
 *
 * **Duas saídas, sempre visíveis, e é de propósito.** "Pular" leva à tela de
 * boas-vindas, que é o significado que a palavra tem em toda parte. Abaixo do
 * botão fica o mesmo convite que a tela de boas-vindas já traz — "Calcular um
 * preço sem criar conta" —, e ele abre a calculadora direto. Assim a
 * calculadora pública continua a um toque na primeira abertura, em vez de ficar
 * atrás de três telas: ela é o principal mecanismo de aquisição do produto
 * (seção 7 do documento 05), e enterrá-la pioraria o aplicativo.
 *
 * Sem dependência nova: um `ScrollView` horizontal com paginação resolve. A
 * largura vem do `onLayout`, e não da janela, porque na web o aplicativo roda
 * dentro de um quadro de largura máxima (`AppFrame`).
 */
export function ApresentacaoView({ onEntrar, onCalculadora }: { onEntrar: () => void; onCalculadora: () => void }) {
  const rolagem = useRef<ScrollView>(null);
  const [largura, setLargura] = useState(0);
  const [indice, setIndice] = useState(0);

  const total = SLIDES_DA_APRESENTACAO.length;
  const ultima = indice === total - 1;

  const irPara = (pagina: number) => {
    setIndice(pagina);
    rolagem.current?.scrollTo({ x: pagina * largura, animated: true });
  };

  return (
    <View style={s.pagina}>
      <View style={s.topo}>
        <Brand />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pular a apresentação e ir para a tela de entrada"
          onPress={onEntrar}
          style={({ pressed }) => [s.pular, pressed && ui.pressed]}
        >
          <Text style={s.pularTexto}>Pular</Text>
        </Pressable>
      </View>

      <View style={ui.grow} onLayout={(evento) => setLargura(evento.nativeEvent.layout.width)}>
        <ScrollView
          ref={rolagem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          // `onScroll` em vez de `onMomentumScrollEnd`: o segundo depende de
          // uma emulação de inércia que a web não garante, e o ponto ativo não
          // pode ficar mentindo sobre onde a pessoa está.
          scrollEventThrottle={16}
          onScroll={(evento) => {
            const pagina = indiceDaRolagem(evento.nativeEvent.contentOffset.x, largura, total);
            if (pagina !== indice) setIndice(pagina);
          }}
        >
          {SLIDES_DA_APRESENTACAO.map((slide) => (
            <View key={slide.id} style={[s.slide, { width: largura }]}>
              <IconBubble name={slide.icone} tone={slide.tom} size={104} />
              <Text accessibilityRole="header" style={s.titulo}>{slide.titulo}</Text>
              <Text style={s.texto}>{slide.texto}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={s.rodape}>
        {/* Sem papel de barra de progresso na fileira: quem lê a tela precisa
            chegar aos pontos como botões, e cada um já anuncia a sua posição. */}
        <View style={s.pontos}>
          {SLIDES_DA_APRESENTACAO.map((slide, posicao) => (
            <Pressable
              key={slide.id}
              accessibilityRole="button"
              accessibilityLabel={`Tela ${posicao + 1} de ${total}: ${slide.titulo}`}
              accessibilityState={{ selected: posicao === indice }}
              onPress={() => irPara(posicao)}
              style={({ pressed }) => [s.alvoDoPonto, pressed && ui.pressed]}
            >
              <View style={[s.ponto, posicao === indice && s.pontoAtivo]} />
            </Pressable>
          ))}
        </View>

        <Button
          label={ultima ? 'Começar' : 'Continuar'}
          icon="arrow"
          onPress={() => (ultima ? onEntrar() : irPara(indice + 1))}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Calcular um preço sem criar conta"
          onPress={onCalculadora}
          style={({ pressed }) => [s.atalho, pressed && ui.pressed]}
        >
          <Text style={s.atalhoTexto}>Calcular um preço sem criar conta</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: colors.background, paddingTop: 16 },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 22 },
  pular: { minHeight: 40, minWidth: 56, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.softLilac, marginBottom: 18 },
  pularTexto: { color: colors.accent, fontSize: 13, fontWeight: '600' },

  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 14 },
  titulo: { color: colors.ink, fontSize: 25, lineHeight: 32, fontWeight: '600', letterSpacing: -0.8, textAlign: 'center', marginTop: 12 },
  texto: { color: colors.muted, fontSize: 13, lineHeight: 21, textAlign: 'center' },

  rodape: { paddingHorizontal: 22, paddingBottom: 22 },
  pontos: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  // O alvo de toque é o quadrado de 32; o ponto é só o desenho dentro dele.
  alvoDoPonto: { minHeight: 32, minWidth: 32, alignItems: 'center', justifyContent: 'center' },
  ponto: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  pontoAtivo: { width: 22, backgroundColor: colors.pink },

  atalho: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  atalhoTexto: { color: colors.accent, fontSize: 13, fontWeight: '600' },
});
