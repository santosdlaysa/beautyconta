import { useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme';
import { Icon, type IconName } from './AppChrome';

/**
 * Vocabulário visual do app, extraído da Home: mesma moldura de página,
 * mesmos raios, mesma tipografia e os mesmos ícones em todas as telas.
 *
 * Cada par de cor abaixo mede pelo menos 4,5 de contraste no fundo em que é
 * usado, como manda a seção 2 do documento 10.
 */

export type Tone = 'neutral' | 'pink' | 'lilac' | 'success' | 'warning' | 'danger';
const tones: Record<Tone, { background: string; color: string }> = {
  neutral: { background: colors.white, color: colors.muted },
  pink: { background: colors.softPink, color: colors.pink },
  lilac: { background: colors.softLilac, color: colors.info },
  success: { background: colors.successSoft, color: colors.success },
  warning: { background: colors.warningSoft, color: colors.warning },
  danger: { background: colors.dangerSoft, color: colors.danger },
};

export function Screen({ children }: PropsWithChildren) {
  return <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>;
}

export function ScreenHeader({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: ReactNode }) {
  return <View style={ui.header}>
    {onBack && <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} style={({ pressed }) => [ui.back, pressed && ui.pressed]}><View style={ui.flip}><Icon name="chevron" size={18} color={colors.accent} /></View></Pressable>}
    <View style={ui.grow}><Text accessibilityRole="header" style={ui.title}>{title}</Text>{subtitle && <Text style={ui.headerSub}>{subtitle}</Text>}</View>
    {right}
  </View>;
}

/** Cartão em gradiente do topo — o mesmo do faturamento na Home. */
export function HeroCard({ label, value, caption, hint, onPress, accessibilityLabel, right }: { label: string; value: string; caption?: string; hint?: string; onPress?: () => void; accessibilityLabel?: string; right?: ReactNode }) {
  return <LinearGradient colors={[colors.pinkGradient, colors.lilac]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={ui.hero}>
    <View style={ui.heroArt}>
      <View style={ui.orbitOuter} /><View style={ui.orbitInner} /><View style={ui.orbitCore} />
      <View style={ui.artSpark}><Icon name="sparkle" size={29} color={colors.white} /></View>
    </View>
    <View style={ui.heroTop}><Text style={ui.heroLabel}>{label}</Text>{right}</View>
    <Text style={ui.heroValue}>{value}</Text>
    <View style={ui.heroBottom}>
      <View style={ui.grow}>{caption && <Text style={ui.heroCaption}>{caption}</Text>}{hint && <Text style={ui.heroHint}>{hint}</Text>}</View>
      {onPress && <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} style={({ pressed }) => [ui.heroArrow, pressed && ui.pressed]}><Icon name="arrow" size={19} color={colors.heroAction} /></Pressable>}
    </View>
  </LinearGradient>;
}

export function Section({ title, action, actionIcon, onAction, first }: { title: string; action?: string; actionIcon?: IconName; onAction?: () => void; first?: boolean }) {
  return <View style={[ui.section, !first && ui.sectionSpaced]}>
    <Text style={ui.sectionTitle}>{title}</Text>
    {(action || actionIcon) && <Pressable accessibilityRole="button" accessibilityLabel={action ?? title} onPress={onAction} style={({ pressed }) => [ui.textButton, pressed && ui.pressed]}>{action && <Text style={ui.link}>{action}</Text>}<Icon name={actionIcon ?? 'chevron'} size={actionIcon ? 19 : 14} color={colors.accent} /></Pressable>}
  </View>;
}

/**
 * Cabeçalho de um passo numerado.
 *
 * A tela de preço pede três coisas antes de calcular, e a numeração vivia só
 * como texto dentro do título da seção — "1. Qual serviço". Lida assim, a
 * sequência não aparece: são três seções iguais, e nada mostra onde a pessoa
 * está nem o que já ficou pronto. O numeral vira marcador, e vira check quando
 * o passo está resolvido.
 */
export function StepHeader({ number, title, hint, done, action, onAction }: { number: number; title: string; hint?: string; done?: boolean; action?: string; onAction?: () => void }) {
  return <View style={ui.step}>
    <View style={[ui.stepMark, done && ui.stepMarkDone]}>
      {done ? <Icon name="check" size={15} color={colors.white} /> : <Text style={ui.stepNumber}>{number}</Text>}
    </View>
    <View style={ui.grow}>
      <Text accessibilityRole="header" style={ui.stepTitle}>{title}</Text>
      {hint && <Text style={ui.stepHint}>{hint}</Text>}
    </View>
    {action && <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onAction} style={({ pressed }) => [ui.textButton, pressed && ui.pressed]}>
      <Text style={ui.link}>{action}</Text><Icon name="chevron" size={13} color={colors.accent} />
    </Pressable>}
  </View>;
}

export function Card({ children, tone = 'neutral', onPress, accessibilityLabel }: PropsWithChildren<{ tone?: Tone; onPress?: () => void; accessibilityLabel?: string }>) {
  const style = [ui.card, tone !== 'neutral' && { backgroundColor: tones[tone].background, borderColor: 'transparent' }];
  if (!onPress) return <View style={style}>{children}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [...style, pressed && ui.pressed]}>{children}</Pressable>;
}

export function IconBubble({ name, tone = 'lilac', size = 42 }: { name: IconName; tone?: Tone; size?: number }) {
  return <View style={[ui.bubble, { width: size, height: size, borderRadius: size / 2, backgroundColor: tones[tone].background }]}><Icon name={name} size={size * 0.46} color={tones[tone].color} /></View>;
}

export function Avatar({ initials, tone = 'pink', size = 42 }: { initials: string; tone?: Tone; size?: number }) {
  return <View style={[ui.bubble, { width: size, height: size, borderRadius: size / 2, backgroundColor: tones[tone].background }]}><Text style={[ui.initials, { color: tones[tone].color, fontSize: size * 0.31 }]}>{initials}</Text></View>;
}

export function Badge({ label, tone = 'success' }: { label: string; tone?: Tone }) {
  return <View style={[ui.badge, { backgroundColor: tones[tone].background }]}><View style={[ui.badgeDot, { backgroundColor: tones[tone].color }]} /><Text style={[ui.badgeText, { color: tones[tone].color }]}>{label}</Text></View>;
}

/** Linha de lista: avatar ou ícone à esquerda, título e legenda no meio, valor ou chevron à direita. */
export function ListRow({ icon, iconTone, initials, title, subtitle, meta, badge, onPress, children }: PropsWithChildren<{ icon?: IconName; iconTone?: Tone; initials?: string; title: string; subtitle?: string; meta?: string; badge?: ReactNode; onPress?: () => void }>) {
  const body = <>
    {initials !== undefined ? <Avatar initials={initials} tone={iconTone ?? 'pink'} size={38} /> : icon ? <IconBubble name={icon} tone={iconTone ?? 'lilac'} size={38} /> : null}
    <View style={ui.grow}>
      <Text style={ui.rowTitle}>{title}</Text>
      {subtitle && <Text style={ui.rowSub}>{subtitle}</Text>}
      {children}
      {badge && <View style={ui.rowBadge}>{badge}</View>}
    </View>
    {meta && <Text style={ui.rowMeta}>{meta}</Text>}
    {onPress && <Icon name="chevron" size={14} color={colors.outline} />}
  </>;
  if (!onPress) return <View style={ui.row}>{body}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [ui.row, pressed && ui.pressed]}>{body}</Pressable>;
}

/**
 * Item de uma lista de escolha: nome, legenda e valor, com estado selecionado.
 *
 * Existe porque `Chips` carrega uma palavra só. Quando cada opção tem mais de
 * um dado — um serviço tem duração e preço —, a escolha por chip esconde
 * justamente o que ajuda a escolher, e o Material 3 manda usar lista. É também
 * o formato que Fresha, Booksy e os kits de salão usam para serviço: nome à
 * esquerda, duração embaixo, preço à direita.
 */
export function SelectRow({ title, subtitle, meta, metaHint, selected, onPress }: { title: string; subtitle?: string; meta?: string; metaHint?: string; selected?: boolean; onPress: () => void }) {
  return <Pressable
    accessibilityRole="radio"
    accessibilityState={{ selected }}
    accessibilityLabel={[title, subtitle, meta].filter(Boolean).join(', ')}
    onPress={onPress}
    style={({ pressed }) => [ui.selectRow, selected && ui.selectRowOn, pressed && ui.pressed]}
  >
    <View style={[ui.selectMark, selected && ui.selectMarkOn]}>
      {selected && <Icon name="check" size={13} color={colors.white} />}
    </View>
    <View style={ui.grow}>
      <Text style={[ui.selectTitle, selected && ui.selectTitleOn]}>{title}</Text>
      {subtitle && <Text style={ui.selectSub}>{subtitle}</Text>}
    </View>
    {meta && <View style={ui.selectMeta}>
      <Text style={[ui.selectValue, selected && ui.selectValueOn]}>{meta}</Text>
      {metaHint && <Text style={ui.selectHint}>{metaHint}</Text>}
    </View>}
  </Pressable>;
}

export function StatCard({ icon, label, value, caption, tone = 'pink', onPress, accessibilityLabel }: { icon?: IconName; label: string; value: string; caption?: string; tone?: Tone; onPress?: () => void; accessibilityLabel?: string }) {
  const style = [ui.stat, { backgroundColor: tones[tone].background }];
  const body = <>
    <View style={ui.statLabelRow}>{icon && <Icon name={icon} size={17} color={tones[tone].color} />}<Text style={ui.statLabel}>{label}</Text></View>
    <Text style={ui.statValue}>{value}</Text>
    {caption && <Text style={ui.statCaption}>{caption}</Text>}
  </>;
  if (!onPress) return <View style={style}>{body}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} style={({ pressed }) => [...style, pressed && ui.pressed]}>{body}</Pressable>;
}

/**
 * Uma linha de dinheiro: rótulo à esquerda, valor à direita.
 *
 * Vivia copiada em três telas, e a composição de preço aparece em todas elas.
 * Aqui é uma só, para que a hierarquia da conta não dependa de qual tela a
 * usuária abriu.
 *
 * `total` traça uma régua acima: sem ela, parcelas e somas empilham iguais e a
 * conta deixa de se ler como conta. `note` carrega a margem ao lado do valor,
 * em corpo menor, em vez de colada no mesmo texto disputando com o número.
 */
export function Line({ label, value, note, strong, total, tone }: { label: string; value: string; note?: string; strong?: boolean; total?: boolean; tone?: 'profit' | 'loss' }) {
  return <View style={[ui.line, total && ui.lineTotal]}>
    <Text style={[ui.lineLabel, strong && ui.lineLabelStrong]}>{label}</Text>
    <View style={ui.lineValueGroup}>
      <Text style={[ui.lineValue, strong && ui.lineValueStrong, tone === 'profit' && ui.lineProfit, tone === 'loss' && ui.lineLoss]}>{value}</Text>
      {note && <Text style={ui.lineNote}>{note}</Text>}
    </View>
  </View>;
}

export function Row({ children }: PropsWithChildren) { return <View style={ui.pair}>{children}</View>; }

/**
 * `inline` tira a margem de baixo.
 *
 * A margem existe para separar botões empilhados, que é o caso comum das
 * telas. Numa linha de ações lado a lado — o diálogo de confirmação —, ela
 * empurra este botão para cima e ele fica desalinhado do vizinho.
 */
export function Button({ label, onPress, secondary, icon, inline }: { label: string; onPress?: () => void; secondary?: boolean; icon?: IconName; inline?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [ui.button, secondary && ui.secondary, inline && ui.buttonInline, pressed && ui.pressed]}>
    {icon && <Icon name={icon} size={17} color={secondary ? colors.accent : colors.white} />}
    <Text style={[ui.buttonText, secondary && { color: colors.accent }]}>{label}</Text>
  </Pressable>;
}

/**
 * Campo de texto.
 *
 * `error` põe a recusa no campo culpado, e não só no topo da folha: quando o
 * servidor responde 422 com `field`, a usuária precisa ver qual dos números
 * ela tem de corrigir. A mensagem entra no rótulo acessível junto do nome do
 * campo, para que o leitor de tela anuncie os dois.
 */
export function Field({ label, value, onChangeText, placeholder, numeric, email, secure, prefix, hint, right, error }: { label: string; value: string; onChangeText: (text: string) => void; placeholder?: string; numeric?: boolean; email?: boolean; secure?: boolean; prefix?: string; hint?: string; right?: ReactNode; error?: string | null }) {
  return <View style={ui.field}>
    <View style={ui.fieldTop}><Text style={ui.label}>{label}</Text>{hint && <Text style={ui.fieldHint}>{hint}</Text>}</View>
    <View style={[ui.inputWrap, error ? ui.inputInvalid : null]}>
      {prefix && <Text style={ui.prefix}>{prefix}</Text>}
      <TextInput accessibilityLabel={error ? `${label}. ${error}` : label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.faded} keyboardType={numeric ? 'decimal-pad' : email ? 'email-address' : 'default'} autoCapitalize={email ? 'none' : 'sentences'} secureTextEntry={secure} style={ui.input} />
      {right}
    </View>
    {error && <Text style={ui.fieldError}>{error}</Text>}
  </View>;
}

/**
 * Escolha entre opções curtas, com rótulo próprio.
 *
 * Existe para que o grupo de fichas tenha o mesmo rótulo associado que um campo
 * de texto tem, exigência do item C-06.
 */
export function ChoiceField({ label, items, value, onChange, hint, spread }: { label: string; items: readonly string[]; value: string; onChange: (item: string) => void; hint?: string; spread?: boolean }) {
  return <View accessibilityRole="radiogroup" accessibilityLabel={label}>
    <Text style={ui.groupLabel}>{label}</Text>
    <Chips items={items} value={value} onChange={onChange} spread={spread} />
    {hint && <Text style={ui.hint}>{hint}</Text>}
  </View>;
}

export function SwitchRow({ label, description, value, onValueChange }: { label: string; description?: string; value: boolean; onValueChange: (next: boolean) => void }) {
  return <View style={ui.switchRow}>
    <View style={ui.grow}>
      <Text style={ui.rowTitle}>{label}</Text>
      {description && <Text style={ui.rowSub}>{description}</Text>}
    </View>
    <Switch
      accessibilityLabel={label}
      value={value}
      onValueChange={onValueChange}
      thumbColor={colors.white}
      trackColor={{ false: colors.border, true: colors.pink }}
    />
  </View>;
}

export function SearchField({ value, onChangeText, placeholder = 'Buscar...' }: { value: string; onChangeText: (text: string) => void; placeholder?: string }) {
  return <View style={ui.search}><Icon name="search" size={17} color={colors.faded} /><TextInput accessibilityLabel={placeholder} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.faded} style={ui.searchInput} /></View>;
}

/**
 * Escolha entre opções curtas.
 *
 * `spread` divide a largura entre elas, com o toque maior e o texto no centro.
 * Serve para duas ou três opções que a pessoa compara — a forma de pagamento,
 * por exemplo; com muitas, as pastilhas soltas continuam melhores, porque
 * quebram em linhas sem apertar o texto.
 */
export function Chips({ items, value, onChange, spread }: { items: readonly string[]; value: string; onChange: (item: string) => void; spread?: boolean }) {
  return <View style={[ui.chips, spread && ui.chipsSpread]}>{items.map(item => {
    const active = item === value;
    return <Pressable
      key={item}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => onChange(item)}
      style={({ pressed }) => [ui.chip, spread && ui.chipWide, active && ui.chipActive, pressed && ui.pressed]}
    >
      <Text style={[ui.chipText, spread && ui.chipTextWide, active && ui.chipTextActive]}>{item}</Text>
    </Pressable>;
  })}</View>;
}

export function EmptyState({ icon = 'sparkle', title, description, action, onAction }: { icon?: IconName; title: string; description?: string; action?: string; onAction?: () => void }) {
  return <View style={ui.empty}>
    <View style={ui.emptyIcon}><Icon name={icon} size={24} color={colors.info} /></View>
    <Text style={ui.emptyTitle}>{title}</Text>
    {description && <Text style={ui.emptyText}>{description}</Text>}
    {action && <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [ui.emptyButton, pressed && ui.pressed]}><Text style={ui.link}>{action}</Text><Icon name="arrow" size={16} color={colors.accent} /></Pressable>}
  </View>;
}

const dayNames = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

/** Posição do dia escolhido dentro da faixa: sempre o meio. */
export const CENTER_DAY = 3;

/**
 * Sete dias em torno de uma data, com ela no centro.
 *
 * A faixa deixou de mostrar a semana do calendário (domingo a sábado) porque o
 * dia de hoje caía onde calhasse — quase na borda numa segunda, na ponta num
 * sábado. Girando em torno do dia escolhido, ele fica sempre no mesmo lugar e a
 * pessoa vê três dias para trás e três para a frente, que é o alcance que a
 * agenda de um estúdio pede.
 */
export function weekAround(day: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(day);
    date.setDate(day.getDate() - CENTER_DAY + index);
    date.setHours(0, 0, 0, 0);
    return date;
  });
}
/** Faixa de dias da semana usada na Home e na Agenda. */
export function WeekStrip({ dates, selected, onSelect, marked }: { dates: Date[]; selected: number; onSelect: (index: number) => void; marked?: (index: number) => boolean }) {
  return <View style={ui.week}>{dates.map((date, index) => {
    const active = selected === index;
    return <Pressable key={date.toISOString()} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} onPress={() => onSelect(index)} style={({ pressed }) => [ui.day, active && ui.activeDay, pressed && ui.pressed]}>
      <Text style={[ui.dayName, active && ui.activeText]}>{dayNames[date.getDay()]}</Text>
      <Text style={[ui.dayNumber, active && ui.activeText]}>{date.getDate()}</Text>
      <View style={[ui.dayDot, marked?.(index) && ui.dayMarked, active && ui.activeDot]} />
    </Pressable>;
  })}</View>;
}

export function TimelinePanel({ title, onAdd, children }: PropsWithChildren<{ title: string; onAdd?: () => void }>) {
  return <View style={ui.timelinePanel}>
    <View style={ui.timelineHeading}><Text style={ui.timelineTitle}>{title}</Text>{onAdd && <Pressable accessibilityRole="button" accessibilityLabel="Novo agendamento" onPress={onAdd} style={({ pressed }) => [ui.addButton, pressed && ui.pressed]}><Icon name="plus" size={17} color={colors.accent} /></Pressable>}</View>
    {children}
  </View>;
}

/**
 * Linha da agenda.
 *
 * `tag` marca a origem do atendimento — hoje, o que entrou sozinho pelo link.
 * Fica ao lado do nome, e não no rodapé da linha, porque é o que a profissional
 * procura ao passar o olho na lista: o que ela ainda não conferiu.
 */
export function TimelineRow({ time, endTime, title, subtitle, initials, meta, status, tag, pending, last, onPress }: { time: string; endTime?: string; title: string; subtitle?: string; initials?: string; meta?: string; status?: string; tag?: string; pending?: boolean; last?: boolean; onPress?: () => void }) {
  const body = <>
    <View style={ui.timeColumn}><Text style={ui.time}>{time}</Text>{endTime && <Text style={ui.endTime}>{endTime}</Text>}</View>
    <View style={ui.timelineTrack}><View style={[ui.timelineDot, pending && ui.pendingDot]} />{!last && <View style={ui.timelineLine} />}</View>
    <View style={ui.appointmentCard}>
      {initials !== undefined && <Avatar initials={initials} tone={pending ? 'lilac' : 'pink'} size={32} />}
      <View style={ui.grow}>
        <View style={ui.titleRow}>
          <Text style={ui.rowTitle}>{title}</Text>
          {tag && <Badge label={tag} tone="lilac" />}
        </View>
        {subtitle && <Text style={ui.rowSub}>{subtitle}</Text>}
        {status && <View style={ui.statusRow}><View style={[ui.statusDot, pending && ui.statusDotPending]} /><Text style={ui.statusText}>{status}</Text></View>}
      </View>
      {meta && <Text style={ui.rowMeta}>{meta}</Text>}
      {onPress && <Icon name="chevron" size={14} color={colors.outline} />}
    </View>
  </>;
  if (!onPress) return <View style={ui.timelineRow}>{body}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${time}`} onPress={onPress} style={({ pressed }) => [ui.timelineRow, pressed && ui.pressed]}>{body}</Pressable>;
}

export function ProgressBar({ value, color = colors.accent }: { value: number; color?: string }) {
  const width: `${number}%` = `${Math.min(Math.max(value, 0), 100)}%`;
  return <View style={ui.progress}><View style={[ui.progressFill, { width, backgroundColor: color }]} /></View>;
}

/**
 * Texto sem espaços — endereço, e-mail — não quebra sozinho na web e escapa da
 * caixa. Como o quadro do aplicativo corta o que transborda (`overflow:
 * hidden`), o excedente não vira rolagem: some da tela.
 */
export const quebraLonga = Platform.select({ web: { wordBreak: 'break-word' } as object, default: {} });

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: 22, paddingTop: 16, paddingBottom: 28 },
  pressed: { opacity: 0.65 },
  grow: { flex: 1, minWidth: 0 },
  flip: { transform: [{ rotate: '180deg' }] },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, marginBottom: 18 },
  back: { width: 40, height: 40, borderRadius: 21, backgroundColor: colors.softLilac, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '600', letterSpacing: -0.6, color: colors.ink },
  headerSub: { fontSize: 11, color: colors.muted, marginTop: 5 },

  hero: { borderRadius: 25, padding: 21, paddingTop: 17, overflow: 'hidden', minHeight: 170, marginBottom: 22 },
  heroArt: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 160, overflow: 'hidden', pointerEvents: 'none' },
  orbitOuter: { position: 'absolute', top: 38, right: -35, width: 143, height: 143, borderRadius: 80, borderWidth: 1, borderColor: colors.orbitLine, transform: [{ scaleX: 1.5 }, { rotate: '-28deg' }] },
  orbitInner: { position: 'absolute', top: 52, right: -20, width: 118, height: 118, borderRadius: 70, borderWidth: 17, borderColor: colors.orbitBand },
  orbitCore: { position: 'absolute', top: 70, right: -2, width: 82, height: 82, borderRadius: 45, backgroundColor: colors.orbitCore },
  artSpark: { position: 'absolute', right: 32, top: 79, opacity: 0.85 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 33 },
  heroLabel: { color: colors.heroLabel, fontSize: 12, fontWeight: '500' },
  heroValue: { color: colors.heroInk, fontSize: 34, fontWeight: '600', letterSpacing: -1.3, marginTop: 6 },
  heroBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16 },
  heroCaption: { color: colors.heroCaption, fontSize: 11 },
  heroHint: { color: colors.heroHint, fontSize: 9, marginTop: 5 },
  heroArrow: { width: 33, height: 33, borderRadius: 18, backgroundColor: colors.heroVeil, alignItems: 'center', justifyContent: 'center' },

  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32, gap: 10, marginBottom: 9 },
  sectionSpaced: { marginTop: 20 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '600', letterSpacing: -0.35 },
  textButton: { minHeight: 32, minWidth: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  link: { color: colors.accent, fontSize: 11, fontWeight: '600' },

  step: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 22, marginBottom: 10 },
  stepMark: { width: 27, height: 27, borderRadius: 14, backgroundColor: colors.softLilac, alignItems: 'center', justifyContent: 'center' },
  stepMarkDone: { backgroundColor: colors.accent },
  stepNumber: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  stepTitle: { color: colors.ink, fontSize: 16, fontWeight: '600', letterSpacing: -0.35 },
  stepHint: { color: colors.muted, fontSize: 11, marginTop: 3 },

  card: { backgroundColor: colors.white, borderRadius: 19, borderWidth: 1, borderColor: colors.border, padding: 15, gap: 11, marginBottom: 13 },
  line: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, minHeight: 26 },
  /** Régua de soma: separa as parcelas do total que elas formam. */
  lineTotal: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 11 },
  lineLabel: { color: colors.ink3, fontSize: 13, flexShrink: 1 },
  lineLabelStrong: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  lineValueGroup: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  /**
   * `tabular-nums` fixa a largura do algarismo: sem isso, cada linha desloca a
   * vírgula alguns pixels e a coluna de valores fica serrilhada.
   */
  lineValue: { color: colors.ink2, fontSize: 13, fontWeight: '500', fontVariant: ['tabular-nums'] },
  lineValueStrong: { color: colors.ink, fontSize: 16, fontWeight: '600', letterSpacing: -0.4 },
  lineProfit: { color: colors.accent },
  lineLoss: { color: colors.danger },
  lineNote: { color: colors.faded, fontSize: 11, fontVariant: ['tabular-nums'] },

  bubble: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontWeight: '600' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 62, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 9 },
  rowTitle: { color: colors.ink2, fontSize: 13, fontWeight: '600' },
  rowSub: { color: colors.ink3, fontSize: 11, marginTop: 4 },
  rowMeta: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  rowBadge: { flexDirection: 'row', marginTop: 7 },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  badgeDot: { width: 4, height: 4, borderRadius: 2 },
  badgeText: { fontSize: 10, fontWeight: '600' },

  selectRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 9 },
  /** Selecionado é borda e fundo, não só cor de texto: precisa ler de relance. */
  selectRowOn: { borderColor: colors.accent, backgroundColor: colors.softPink },
  selectMark: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.outline, alignItems: 'center', justifyContent: 'center' },
  selectMarkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  selectTitle: { color: colors.ink2, fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
  selectTitleOn: { color: colors.ink },
  selectSub: { color: colors.ink3, fontSize: 11, marginTop: 4 },
  selectMeta: { alignItems: 'flex-end' },
  selectValue: { color: colors.ink2, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  selectValueOn: { color: colors.accent },
  selectHint: { color: colors.faded, fontSize: 10, marginTop: 3 },

  pair: { flexDirection: 'row', gap: 11, marginBottom: 13 },
  stat: { flex: 1, borderRadius: 19, padding: 15 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLabel: { color: colors.muted, fontSize: 10 },
  statValue: { color: colors.heroCaption, fontSize: 19, fontWeight: '600', letterSpacing: -0.5, marginTop: 11 },
  statCaption: { color: colors.faded, fontSize: 9, marginTop: 5 },

  button: { flexDirection: 'row', gap: 8, backgroundColor: colors.pink, minHeight: 48, borderRadius: 25, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  secondary: { backgroundColor: colors.softLilac },
  buttonInline: { marginBottom: 0 },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: '600', textAlign: 'center' },

  field: { gap: 7 },
  groupLabel: { fontSize: 12, fontWeight: '500', color: colors.muted, marginBottom: 9 },
  hint: { color: colors.faded, fontSize: 11, lineHeight: 17, marginTop: -6, marginBottom: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  fieldTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { fontSize: 12, fontWeight: '500', color: colors.muted },
  fieldHint: { fontSize: 12, fontWeight: '600', color: colors.accent },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, backgroundColor: colors.white, borderRadius: 16, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 14 },
  // A borda é sinal de apoio; quem diz o que houve é o texto abaixo, porque cor
  // sozinha não chega a quem não a enxerga.
  inputInvalid: { borderColor: colors.danger },
  fieldError: { color: colors.danger, fontSize: 11, lineHeight: 17 },
  prefix: { fontSize: 12, color: colors.muted },
  input: { flex: 1, minWidth: 0, paddingVertical: 12, fontSize: 14, color: colors.ink },
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 46, backgroundColor: colors.white, borderRadius: 23, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, marginBottom: 14 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 13, color: colors.ink },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 19, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.pink, borderColor: colors.pink },
  chipsSpread: { flexWrap: 'nowrap' },
  chipWide: { flex: 1, minHeight: 52, borderRadius: 26, alignItems: 'center', paddingHorizontal: 10 },
  chipTextWide: { fontSize: 14, textAlign: 'center' },
  chipText: { fontSize: 12, color: colors.muted },
  chipTextActive: { color: colors.white, fontWeight: '600' },

  empty: { alignItems: 'center', paddingVertical: 22, paddingHorizontal: 18 },
  emptyIcon: { width: 45, height: 45, borderRadius: 24, backgroundColor: colors.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.ink, fontSize: 13, fontWeight: '600', marginTop: 10 },
  emptyText: { color: colors.muted, fontSize: 11, textAlign: 'center', lineHeight: 18, marginTop: 5 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, marginTop: 4 },

  week: { flexDirection: 'row', justifyContent: 'space-between', gap: 3, marginBottom: 20 },
  day: { flex: 1, minHeight: 68, paddingVertical: 9, borderRadius: 24, alignItems: 'center', justifyContent: 'center', gap: 6 },
  activeDay: { backgroundColor: colors.pink },
  dayName: { color: colors.muted, fontSize: 8, fontWeight: '500', letterSpacing: 0.2 },
  dayNumber: { color: colors.ink, fontSize: 15, fontWeight: '500' },
  activeText: { color: colors.white },
  dayDot: { height: 3, width: 3, borderRadius: 2, backgroundColor: 'transparent' },
  dayMarked: { backgroundColor: colors.marker },
  activeDot: { backgroundColor: colors.white },

  timelinePanel: { backgroundColor: colors.softLilac, borderRadius: 23, padding: 15, paddingBottom: 8, marginBottom: 6 },
  timelineHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28, marginBottom: 13 },
  timelineTitle: { color: colors.ink3, fontSize: 11, fontWeight: '500', textTransform: 'capitalize' },
  addButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.white },
  timelineRow: { flexDirection: 'row', alignItems: 'stretch', minHeight: 74 },
  timeColumn: { width: 36, paddingTop: 12 },
  time: { fontSize: 10, fontWeight: '500', color: colors.ink3 },
  endTime: { fontSize: 8, color: colors.ink3, marginTop: 5 },
  timelineTrack: { width: 14, alignItems: 'center', paddingTop: 15 },
  timelineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.marker, borderColor: colors.softLilac, borderWidth: 1, zIndex: 1 },
  pendingDot: { backgroundColor: colors.markerPending },
  timelineLine: { position: 'absolute', top: 22, bottom: -12, width: 1, backgroundColor: colors.trail },
  appointmentCard: { flex: 1, marginLeft: 6, marginBottom: 8, padding: 10, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: colors.white },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  statusDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.success },
  statusDotPending: { backgroundColor: colors.warning },
  statusText: { color: colors.ink3, fontSize: 10 },

  progress: { height: 5, borderRadius: 4, backgroundColor: colors.track, marginTop: 9, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 4 },

  loading: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 40 },
  loadingFull: { flex: 1 },
  loadingText: { color: colors.muted, fontSize: 12 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 16, padding: 13, marginBottom: 13 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },

  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.veil },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '92%', paddingTop: 10 },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 3, backgroundColor: colors.border },
  sheetContent: { padding: 22, paddingTop: 16, paddingBottom: 34, gap: 14 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sheetTitle: { fontSize: 19, fontWeight: '600', letterSpacing: -0.5, color: colors.ink },
  sheetClose: { width: 34, height: 34, borderRadius: 18, backgroundColor: colors.softLilac, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }] },
  confirmBox: { backgroundColor: colors.dangerSoft, borderRadius: 18, padding: 14, gap: 11 },
  confirmText: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  confirmActions: { flexDirection: 'row', gap: 9 },
  confirmCancel: { flex: 1, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  confirmCancelText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  confirmDelete: { flex: 1, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger },
  confirmDeleteText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  deleteButton: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  deleteText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});

/**
 * Estados de carregamento, falha e formulário.
 *
 * Ficam no mesmo arquivo do resto do sistema visual porque são parte do padrão:
 * toda tela que fala com o servidor mostra os três do mesmo jeito.
 */
/**
 * Espera.
 *
 * `full` ocupa o espaço que sobra e centraliza — é o caso de quando a espera é
 * a tela inteira, como ao abrir a conta. Sem ele, o indicador fica no fluxo,
 * junto do conteúdo que está sendo atualizado.
 */
export function Loading({ label = 'Carregando...', full }: { label?: string; full?: boolean }) {
  return <View style={[ui.loading, full && ui.loadingFull]}><ActivityIndicator color={colors.accent} /><Text style={ui.loadingText}>{label}</Text></View>;
}

export function Notice({ message, tone = 'danger', action, onAction }: { message: string; tone?: Tone; action?: string; onAction?: () => void }) {
  return <View style={[ui.notice, { backgroundColor: tones[tone].background }]}>
    <Icon name={tone === 'danger' ? 'alert' : 'sparkle'} size={17} color={tones[tone].color} />
    <Text style={[ui.noticeText, { color: tones[tone].color }]}>{message}</Text>
    {action && <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [ui.textButton, pressed && ui.pressed]}><Text style={[ui.link, { color: tones[tone].color }]}>{action}</Text></Pressable>}
  </View>;
}

/**
 * Limite do plano atingido (item F-01).
 *
 * A mensagem vem inteira do servidor e é exibida como está: é ela que explica o
 * que muda ao assinar. Nada do que a usuária já cadastrou — nem o que ela
 * acabou de digitar — sai da tela por causa deste aviso.
 */
export function PlanLimitNotice({ message, onUpgrade }: { message: string; onUpgrade?: () => void }) {
  return <Notice tone="warning" message={message} action={onUpgrade ? 'Ver planos' : undefined} onAction={onUpgrade} />;
}

/** Folha de leitura: detalhe de um registro, sem formulário e sem ação de salvar. */
export function DetailSheet({ visible, title, subtitle, onClose, children }: PropsWithChildren<{ visible: boolean; title: string; subtitle?: string; onClose: () => void }>) {
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={ui.sheetBackdrop}>
      <View style={ui.sheet}>
        <View style={ui.sheetHandle} />
        <ScrollView contentContainerStyle={ui.sheetContent} showsVerticalScrollIndicator={false}>
          <View style={ui.sheetHeader}>
            <View style={ui.grow}><Text accessibilityRole="header" style={ui.sheetTitle}>{title}</Text>{subtitle && <Text style={ui.headerSub}>{subtitle}</Text>}</View>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={onClose} style={({ pressed }) => [ui.sheetClose, pressed && ui.pressed]}><Icon name="plus" size={18} color={colors.muted} /></Pressable>
          </View>
          {children}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

/** Folha de formulário: criar e editar acontecem sem sair da tela da lista. */
/**
 * Folha de formulário.
 *
 * A confirmação de exclusão é embutida, e não um alerta do sistema: o
 * `Alert.alert` do React Native não faz nada na web, e o botão excluir sumia em
 * silêncio no navegador. Aqui a pergunta aparece na própria folha, igual nas
 * duas plataformas.
 *
 * `actionsHidden` some com as ações da folha enquanto um subformulário está
 * aberto dentro dela — dois botões de salvar na mesma tela, um do serviço e
 * outro do material, é ambiguidade que a usuária não tem por que resolver.
 */
export function FormSheet({ visible, title, subtitle, submitLabel = 'Salvar', busy, error, limitReached, onUpgrade, onClose, onSubmit, onDelete, deleteLabel = 'Excluir', deleteQuestion, actionsHidden, children }: PropsWithChildren<{ visible: boolean; title: string; subtitle?: string; submitLabel?: string; busy?: boolean; error?: string | null; limitReached?: boolean; onUpgrade?: () => void; onClose: () => void; onSubmit: () => void; onDelete?: () => void; deleteLabel?: string; deleteQuestion?: string; actionsHidden?: boolean }>) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Reabrir a folha nunca começa com a pergunta de exclusão na tela.
  useEffect(() => {
    if (!visible) setConfirmingDelete(false);
  }, [visible]);

  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={ui.sheetBackdrop}>
      <View style={ui.sheet}>
        <View style={ui.sheetHandle} />
        <ScrollView contentContainerStyle={ui.sheetContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={ui.sheetHeader}>
            <View style={ui.grow}><Text accessibilityRole="header" style={ui.sheetTitle}>{title}</Text>{subtitle && <Text style={ui.headerSub}>{subtitle}</Text>}</View>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={onClose} style={({ pressed }) => [ui.sheetClose, pressed && ui.pressed]}><Icon name="plus" size={18} color={colors.muted} /></Pressable>
          </View>
          {error && (limitReached
            ? <PlanLimitNotice message={error} onUpgrade={onUpgrade} />
            : <Notice message={error} />)}
          {children}

          {!actionsHidden && <>
            <Button label={busy ? 'Salvando...' : submitLabel} icon="check" onPress={busy ? undefined : onSubmit} />

            {onDelete && (confirmingDelete
              ? <View style={ui.confirmBox}>
                  <Text style={ui.confirmText}>{deleteQuestion ?? 'Tem certeza? Isso não dá para desfazer.'}</Text>
                  <View style={ui.confirmActions}>
                    <Pressable accessibilityRole="button" onPress={() => setConfirmingDelete(false)} style={({ pressed }) => [ui.confirmCancel, pressed && ui.pressed]}>
                      <Text style={ui.confirmCancelText}>Cancelar</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={busy ? undefined : onDelete} style={({ pressed }) => [ui.confirmDelete, pressed && ui.pressed]}>
                      <Text style={ui.confirmDeleteText}>{busy ? 'Excluindo...' : deleteLabel}</Text>
                    </Pressable>
                  </View>
                </View>
              : <Pressable accessibilityRole="button" onPress={() => setConfirmingDelete(true)} style={({ pressed }) => [ui.deleteButton, pressed && ui.pressed]}>
                  <Text style={ui.deleteText}>{deleteLabel}</Text>
                </Pressable>)}
          </>}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
