import { colors } from '../theme';
import type { PropsWithChildren } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

export type IconName = 'home' | 'calculator' | 'users' | 'calendar' | 'chart' | 'box' | 'settings' | 'sparkle' | 'arrow' | 'eye' | 'eye-off' | 'chevron' | 'check' | 'plus' | 'wallet' | 'search' | 'filter' | 'bell' | 'lock' | 'help' | 'logout' | 'store' | 'alert' | 'clock' | 'tag' | 'trend' | 'edit';
const paths: Record<IconName, string> = {
  home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  calculator: 'M8 7h8M8 12h1m6 0h1m-8 5h1m6 0h1',
  users: 'M3 21v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2m2-7a5 5 0 0 1 4 5v2M16 3a4 4 0 0 1 0 8',
  calendar: 'M4 9h16M8 2v4m8-4v4M8 13h1m6 0h1m-8 4h1m6 0h1',
  chart: 'M4 3v17h17M8 15l4-5 4 2 5-7',
  box: 'm3 7 9-4 9 4v10l-9 4-9-4Zm0 0 9 4 9-4m-9 4v10M7 5l10 4',
  settings: 'M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
  sparkle: 'M12 2c1 7 3 9 10 10-7 1-9 3-10 10-1-7-3-9-10-10 7-1 9-3 10-10Z',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z',
  'eye-off': 'm3 3 18 18M9 5.4A10 10 0 0 1 12 5c6 0 10 7 10 7a20 20 0 0 1-3 4M6 6.5A23 23 0 0 0 2 12s4 7 10 7c1 0 2-.2 3-.5',
  chevron: 'm9 5 7 7-7 7',
  check: 'm5 12 4 4L19 6',
  plus: 'M12 5v14M5 12h14',
  wallet: 'M20 8V5H5a2 2 0 0 0 0 4h16v12H5a2 2 0 0 1-2-2V7m18 6h-5v4h5',
  search: 'm16.5 16.5 4.5 4.5',
  filter: 'M4 6h16M7 12h10M10 18h4',
  bell: 'M18 15v-5a6 6 0 1 0-12 0v5l-2 3h16ZM10 21h4',
  lock: 'M8 10V7.5a4 4 0 0 1 8 0V10m-4 4v3',
  help: 'M9.3 9.4a2.8 2.8 0 1 1 3.4 3.4v1.5m-.7 3h.01',
  logout: 'M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10',
  store: 'm4 9 1.6-5h12.8L20 9M9 20v-6h6v6',
  alert: 'M12 3.5 2.8 20h18.4ZM12 10v4m0 3h.01',
  clock: 'M12 7v5l3.2 2',
  tag: 'M3.5 12.2V4h8.2l8.8 8.8-8.2 8.2ZM7.6 7.7h.01',
  trend: 'm3 17 6-6 4 4 8-8m0 0h-5m5 0v5',
  edit: 'M4 20h4L20 8l-4-4L4 16ZM15 5l4 4',
};
/**
 * Ícone sempre decorativo: quem carrega o significado é o texto ou o rótulo de
 * acessibilidade do botão em volta. Esconder do leitor de tela se diz de um
 * jeito em cada plataforma — a build web do `react-native-svg` repassa as props
 * desconhecidas direto para o elemento, e `accessible` não existe no DOM.
 */
const hidden = Platform.OS === 'web' ? { 'aria-hidden': true } : { accessible: false };

export function Icon({ name, size = 22, color = '#44344F' }: { name: IconName; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" {...hidden}>
    {(name === 'calculator' || name === 'calendar') && <Rect x={4} y={name === 'calendar' ? 4 : 2} width={16} height={name === 'calendar' ? 18 : 20} rx={3} />}
    {name === 'lock' && <Rect x={4} y={10} width={16} height={11} rx={3} />}
    {name === 'store' && <Rect x={4} y={9} width={16} height={11} rx={2} />}
    {name === 'users' && <Circle cx={9} cy={7} r={4} />}
    {name === 'settings' && <Circle cx={12} cy={12} r={6} />}
    {name === 'eye' && <Circle cx={12} cy={12} r={3} />}
    {name === 'search' && <Circle cx={11} cy={11} r={7} />}
    {(name === 'help' || name === 'clock') && <Circle cx={12} cy={12} r={9} />}
    <Path d={paths[name]} />
  </Svg>;
}

export function AppFrame({ children }: PropsWithChildren) {
  return <SafeAreaProvider><View style={s.canvas}><SafeAreaView edges={['top', 'bottom']} style={s.frame}>{children}</SafeAreaView></View></SafeAreaProvider>;
}

const tabs = [
  { route: 'inicio', label: 'Início', icon: 'home' },
  { route: 'agenda', label: 'Agenda', icon: 'calendar' },
  { route: 'calcular', label: 'Calcular', icon: 'plus' },
  { route: 'financeiro', label: 'Finanças', icon: 'chart' },
  { route: 'perfil', label: 'Perfil', icon: 'users' },
] as const;

export function AppTabs({ active, onChange }: { active: string; onChange: (route: typeof tabs[number]['route']) => void }) {
  return <View style={s.navigation}>{tabs.map(({ route, label, icon }) => {
    const selected = active === route;
    const primary = route === 'calcular';
    return <Pressable key={route} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} onPress={() => onChange(route)} style={({ pressed }) => [s.tab, pressed && { opacity: 0.65 }]}>
      <View style={[s.icon, selected && !primary && s.active, primary && s.primary]}><Icon name={icon} size={primary ? 25 : 21} color={primary ? '#fff' : selected ? colors.accent : colors.muted} /></View>
      <Text style={[s.label, selected && { color: colors.accent, fontWeight: '700' }]}>{label}</Text>
    </Pressable>;
  })}</View>;
}

const s = StyleSheet.create({
  canvas: { flex: 1, alignItems: 'center', backgroundColor: colors.softLilac },
  frame: { flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 460 : undefined, backgroundColor: colors.background, overflow: 'hidden' },
  navigation: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F3EDF2', paddingHorizontal: 10, paddingTop: 7, paddingBottom: 9, flexShrink: 0 },
  tab: { flex: 1, minHeight: 55, alignItems: 'center', justifyContent: 'center', gap: 3 },
  icon: { height: 32, width: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  active: { backgroundColor: colors.lilac },
  primary: { backgroundColor: colors.pinkHighlight, width: 46, height: 38, borderRadius: 15 },
  label: { fontSize: 10, color: colors.muted },
});
