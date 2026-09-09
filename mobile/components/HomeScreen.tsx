import { colors } from '../theme';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatCents } from '../lib/useSubmit';
import { useApp } from '../state/AppProvider';
import { Icon } from './AppChrome';
import { EmptyState, HeroCard, ListRow, Notice, Row, Screen, Section, StatCard, TimelinePanel, TimelineRow, WeekStrip, ui } from './ui';

export type HomeRoute = 'inicio' | 'calcular' | 'servicos' | 'custos' | 'planos' | 'clientes' | 'agenda' | 'financeiro' | 'estoque' | 'relatorios' | 'perfil';

const shortcuts = [
  { label: 'Calcular', route: 'calcular', icon: 'calculator', background: '#FCE4EE', color: '#C94282' },
  { label: 'Serviços', route: 'servicos', icon: 'sparkle', background: colors.lilac, color: '#7D66AC' },
  { label: 'Custos', route: 'custos', icon: 'wallet', background: colors.softPink, color: '#B37B4B' },
  { label: 'Estoque', route: 'estoque', icon: 'box', background: colors.softLilac, color: '#548A73' },
] as const;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const hourOf = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const endOf = (iso: string, minutes: number) =>
  new Date(new Date(iso).getTime() + minutes * 60_000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const initialsOf = (name: string) => name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
const firstName = (name: string) => name.trim().split(' ')[0];

export function HomeScreen({ onNavigate }: { onNavigate: (route: HomeRoute) => void }) {
  const app = useApp();
  const [today] = useState(() => new Date());
  const [visibleValues, setVisibleValues] = useState(true);
  const selectedDay = app.agendaDay.getDay();

  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - today.getDay() + index);
    return date;
  }), [today]);

  const selectedDate = week[selectedDay];
  const appointments = app.appointments;
  const summary = app.daySummary;
  const dateLabel = selectedDay === today.getDay() ? 'Hoje' : selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' });
  const month = capitalize(today.toLocaleDateString('pt-BR', { month: 'long' }));

  // Serviço arquivado saiu da tabela: não conta na média nem no aviso de setup.
  const activeServices = app.services.filter(service => !service.isArchived);
  const priced = activeServices.filter(service => service.currentPriceCents !== null);
  const average = priced.length ? priced.reduce((sum, item) => sum + (item.currentPriceCents ?? 0), 0) / priced.length : 0;
  const fixedTotal = app.fixedCosts.reduce((sum, item) => sum + (item.isActive ? item.monthlyAmountCents : 0), 0);
  const lastCalculation = app.calculations[0] ?? null;
  const hourly = app.settings?.hourlyRateCents ?? null;

  /** Ocultar valores é da usuária: a Home fica visível para clientes o tempo todo. */
  const money = (cents: number) => (visibleValues ? formatCents(cents) : 'R$ ••••');

  const isToday = app.agendaDay.toDateString() === today.toDateString();
  const missingSetup = app.services.length === 0 || app.fixedCosts.length === 0;

  return (
    <Screen>
      <View style={s.header}>
        <View>
          <View style={s.brandRow}><Icon name="sparkle" size={20} color={colors.accent} /><Text style={s.brand}>beauty<Text style={s.brandAccent}>conta</Text></Text></View>
          <Text style={s.greeting}>{app.user ? `Olá, ${firstName(app.user.name)}. Um novo dia para o seu negócio.` : 'Um novo dia para o seu negócio.'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir meu perfil" onPress={() => onNavigate('perfil')} style={({ pressed }) => [s.avatar, pressed && ui.pressed]}>
          <Icon name="users" size={22} color="#8D5F8A" />
          <View style={s.avatarDot} />
        </Pressable>
      </View>

      {/* O primeiro número do dia é o caixa do dia: o que já entrou. */}
      <HeroCard
        label={isToday ? 'Recebido hoje' : `Recebido em ${selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}
        value={money(summary?.receivedCents ?? 0)}
        caption={summary && summary.appointments > 0
          ? `${summary.appointments} ${summary.appointments === 1 ? 'atendimento' : 'atendimentos'} · ${money(summary.expectedCents)} combinados`
          : `${month} · nenhum atendimento marcado`}
        hint={summary && summary.pendingCents > 0
          ? `${money(summary.pendingCents)} ainda a receber`
          : hourly ? `Sua hora vale ${money(hourly)}` : 'Configure sua hora em Custos'}
        onPress={() => onNavigate('agenda')}
        accessibilityLabel="Abrir a agenda"
        right={<Pressable accessibilityRole="button" accessibilityLabel={visibleValues ? 'Ocultar valores' : 'Mostrar valores'} onPress={() => setVisibleValues(!visibleValues)} style={({ pressed }) => [s.eyeButton, pressed && ui.pressed]}><Icon name={visibleValues ? 'eye' : 'eye-off'} size={19} color="#6E4C78" /></Pressable>}
      />

      <View style={s.shortcuts}>
        {shortcuts.map(item => (
          <Pressable key={item.route} accessibilityRole="button" onPress={() => onNavigate(item.route)} style={({ pressed }) => [s.shortcut, pressed && ui.pressed]}>
            <View style={[s.shortcutCircle, { backgroundColor: item.background }]}><Icon name={item.icon} size={24} color={item.color} /></View>
            <Text style={s.shortcutLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* O cálculo feito antes do cadastro chegou junto com a conta (item D-03). */}
      {app.migratedCalculation && <Notice
        tone="success"
        message={`Guardamos o cálculo que você fez antes de criar a conta: ${money(app.migratedCalculation.commercialPriceCents)} no seu histórico.`}
        action="Ver"
        onAction={() => { app.dismissMigration(); onNavigate('calcular'); }}
      />}

      {missingSetup && <Notice
        tone="lilac"
        message={activeServices.length === 0
          ? 'Cadastre seu primeiro serviço para a calculadora trabalhar com os seus números.'
          : 'Cadastre seus custos fixos: sem eles, o rateio do preço fica incompleto.'}
        action="Começar"
        onAction={() => onNavigate(activeServices.length === 0 ? 'servicos' : 'custos')}
      />}

      <Section title="Sua agenda" action="Ver tudo" onAction={() => onNavigate('agenda')} first />
      <View style={s.calendarMeta}>
        <Text style={s.month}>{selectedDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</Text>
        <Text style={s.calendarHint}>
          {summary && summary.appointments > 0 ? `${money(summary.receivedCents)} recebidos` : 'nenhum atendimento'}
        </Text>
      </View>
      <WeekStrip dates={week} selected={selectedDay} onSelect={index => void app.showAgendaDay(week[index])} />

      <TimelinePanel title={`${dateLabel}, ${selectedDate.getDate()}`} onAdd={() => onNavigate('agenda')}>
        {appointments.length === 0
          ? <EmptyState icon="calendar" title="Seu dia está livre" description="Um respiro na agenda ou espaço para uma nova cliente." action="Marcar atendimento" onAction={() => onNavigate('agenda')} />
          : appointments.map((appointment, index) => (
            <TimelineRow
              key={appointment.id}
              time={hourOf(appointment.startsAt)}
              endTime={endOf(appointment.startsAt, appointment.durationMinutes)}
              initials={initialsOf(appointment.clientName)}
              title={appointment.clientName}
              subtitle={`${app.services.find(item => item.id === appointment.serviceId)?.name ?? 'Sem serviço'} · ${money(appointment.priceCents)}`}
              status={appointment.pendingCents === 0 && appointment.paidCents > 0 ? 'Pago' : appointment.status === 'CANCELED' ? 'Cancelado' : 'A receber'}
              pending={appointment.pendingCents > 0}
              last={index === appointments.length - 1}
              onPress={() => onNavigate('agenda')}
            />
          ))}
      </TimelinePanel>

      <Section title="Seu negócio em números" actionIcon="chart" onAction={() => onNavigate('relatorios')} />
      <Row>
        <StatCard icon="wallet" label="Custos fixos" value={money(fixedTotal)} caption={`${app.fixedCosts.length} por mês`} onPress={() => onNavigate('custos')} />
        <StatCard
          icon="tag"
          label={lastCalculation ? 'Último preço calculado' : 'Preço médio da tabela'}
          value={money(lastCalculation ? lastCalculation.commercialPriceCents : average)}
          caption={lastCalculation
            ? app.services.find(item => item.id === lastCalculation.serviceId)?.name ?? 'Cálculo avulso'
            : `${activeServices.length} ${activeServices.length === 1 ? 'serviço' : 'serviços'}`}
          tone="lilac"
          onPress={() => onNavigate('calcular')}
        />
      </Row>

      <Section title="Meu negócio" />
      <ListRow icon="box" title="Estoque" subtitle={`${app.materials.length} ${app.materials.length === 1 ? 'material cadastrado' : 'materiais cadastrados'}`} onPress={() => onNavigate('estoque')} />
      <ListRow icon="sparkle" iconTone="pink" title="Meu plano" subtitle={app.subscription?.plan === 'FREE' ? 'Gratuito · conheça o Premium' : 'Assinatura ativa'} onPress={() => onNavigate('planos')} />
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 23 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brand: { color: colors.ink, fontSize: 23, fontWeight: '700', letterSpacing: -1 },
  brandAccent: { color: colors.accent, fontWeight: '400' },
  greeting: { color: colors.muted, fontSize: 11, marginTop: 5, maxWidth: 240 },
  avatar: { width: 43, height: 43, borderRadius: 24, backgroundColor: '#F5E8F0', borderWidth: 3, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  avatarDot: { position: 'absolute', right: -1, bottom: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#91B49F', borderWidth: 2, borderColor: '#FFFCFD' },
  eyeButton: { width: 33, height: 33, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#FFFFFF32' },
  shortcuts: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 27 },
  shortcut: { flex: 1, alignItems: 'center', gap: 9 },
  shortcutCircle: { width: 52, height: 52, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { color: '#615566', fontSize: 11 },
  calendarMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  month: { color: colors.muted, fontSize: 11, textTransform: 'capitalize' },
  calendarHint: { color: colors.faded, fontSize: 10 },
});
