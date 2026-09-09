import { colors } from '../theme';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatPhone, telUrl, whatsappUrl } from '../lib/booking';
import { listAppointments, type Appointment, type AppointmentStatus } from '../lib/resources';
import { centsToInput, formatCents, parseCents, parseNumber, useSubmit } from '../lib/useSubmit';
import { useApp } from '../state/AppProvider';
import { useDialog } from './Dialog';
import {
  Badge,
  Button,
  Card,
  ChoiceField,
  EmptyState,
  Field,
  FormSheet,
  HeroCard,
  ListRow,
  Notice,
  Row,
  Screen,
  ScreenHeader,
  Section,
  StatCard,
  TimelinePanel,
  TimelineRow,
  WeekStrip,
  ui,
} from './ui';

/**
 * Agenda do dia.
 *
 * O que a profissional acompanha aqui é o caixa do dia, não a lista de
 * horários: quanto foi combinado, quanto entrou e quanto falta entrar. Marcar
 * como pago é o gesto mais frequente, então ele é um toque na própria linha.
 */

const STATUS: { slug: AppointmentStatus; label: string }[] = [
  { slug: 'SCHEDULED', label: 'Agendado' },
  { slug: 'CONFIRMED', label: 'Confirmado' },
  { slug: 'DONE', label: 'Atendida' },
  { slug: 'CANCELED', label: 'Cancelado' },
  { slug: 'NO_SHOW', label: 'Não veio' },
];

const labelOfStatus = (slug: AppointmentStatus) => STATUS.find(item => item.slug === slug)?.label ?? slug;
const slugOfStatus = (label: string) => STATUS.find(item => item.label === label)?.slug ?? 'SCHEDULED';

const hourOf = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const endOf = (iso: string, minutes: number) => {
  const end = new Date(new Date(iso).getTime() + minutes * 60_000);
  return end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};
const initialsOf = (name: string) => name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();

/** `AAAA-MM-DDTHH:MM` local para o ISO com fuso que a API espera. */
function isoFrom(day: Date, time: string): string | null {
  const match = time.trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  const date = new Date(day);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

const emptyForm = { clientName: '', service: 'Nenhum', time: '09:00', duration: '60', price: '', status: 'Agendado' };

export function AgendaScreen({ onBack, onAction }: { onBack?: () => void; onAction?: (action: string) => void }) {
  const app = useApp();
  const dialog = useDialog();
  const { busy, error, setError, clear, run } = useSubmit();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [incoming, setIncoming] = useState<Appointment[]>([]);

  const today = useMemo(() => new Date(), []);
  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - today.getDay() + index);
    return date;
  }), [today]);

  const selectedDay = week.findIndex(date => date.toDateString() === app.agendaDay.toDateString());
  const summary = app.daySummary;
  const serviceNames = ['Nenhum', ...app.services.map(item => item.name)];

  // A agenda abre no dia de hoje; trocar de dia recarrega do servidor.
  useEffect(() => {
    if (selectedDay === -1) void app.showAgendaDay(today);
  }, [selectedDay, today, app]);

  const token = app.token;
  const businessId = app.business?.id;

  /**
   * O que entrou pelo link e ainda vem por aí.
   *
   * Busca à parte da agenda do dia porque a pergunta é outra: o dia é o que ela
   * tem pela frente agora, e isto é o que apareceu sozinho e ela ainda não
   * conferiu — quase sempre em outra data. A janela acompanha a da agenda
   * pública, que aceita marcar com até sessenta dias de antecedência.
   */
  const loadIncoming = useCallback(async () => {
    if (!token || !businessId) return;

    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + 60);

    try {
      const found = await listAppointments({ token, businessId }, { from, to });
      setIncoming(found.filter(item => item.source === 'ONLINE'));
    } catch {
      // Falhar aqui não pode esconder a agenda do dia, que é o essencial da
      // tela: a lista de conferência simplesmente não aparece desta vez.
      setIncoming([]);
    }
  }, [token, businessId]);

  useEffect(() => {
    void loadIncoming();
  }, [loadIncoming]);

  /** Marcado pelo link, ainda por vir e sem confirmação dela: é o que pede conferência. */
  const toReview = useMemo(() => {
    const now = Date.now();
    return incoming
      .filter(item => item.status === 'SCHEDULED' && new Date(item.startsAt).getTime() >= now)
      .sort((first, second) => first.startsAt.localeCompare(second.startsAt));
  }, [incoming]);

  const openContact = (url: string | null) => {
    if (!url) {
      dialog.inform({ title: 'Telefone incompleto', message: 'O número que a cliente deixou não dá para discar. Confira com ela na próxima conversa.' });
      return;
    }
    void Linking.openURL(url).catch(() => {
      dialog.inform({ title: 'Não conseguimos abrir', message: 'Este aparelho não abriu o aplicativo de contato. Copie o número e fale com a cliente por fora.' });
    });
  };

  /** Confere e confirma: é o gesto que tira o atendimento da lista de pendências. */
  const confirmBooking = (appointment: Appointment) => {
    void run(async () => {
      await app.updateAppointment(appointment.id, { status: 'CONFIRMED' });
      await loadIncoming();
    });
  };

  const startNew = () => {
    setEditing(null);
    setForm(emptyForm);
    clear();
    setOpen(true);
  };

  const startEdit = (appointment: Appointment) => {
    setEditing(appointment);
    setForm({
      clientName: appointment.clientName,
      service: app.services.find(item => item.id === appointment.serviceId)?.name ?? 'Nenhum',
      time: hourOf(appointment.startsAt),
      duration: String(appointment.durationMinutes),
      price: centsToInput(appointment.priceCents),
      status: labelOfStatus(appointment.status),
    });
    clear();
    setOpen(true);
  };

  /** Escolher o serviço traz duração e preço já cadastrados. */
  const chooseService = (name: string) => {
    const service = app.services.find(item => item.name === name);
    setForm(current => ({
      ...current,
      service: name,
      duration: service ? String(service.durationMinutes) : current.duration,
      price: service?.currentPriceCents ? centsToInput(service.currentPriceCents) : current.price,
    }));
  };

  const submit = () => {
    const startsAt = isoFrom(app.agendaDay, form.time);
    if (!form.clientName.trim()) {
      setError('Diga o nome da cliente.');
      return;
    }
    if (!startsAt) {
      setError('Escreva o horário no formato HH:MM.');
      return;
    }

    const input = {
      clientName: form.clientName.trim(),
      serviceId: app.services.find(item => item.name === form.service)?.id ?? null,
      startsAt,
      durationMinutes: Math.max(Math.round(parseNumber(form.duration)), 1),
      priceCents: parseCents(form.price),
      status: slugOfStatus(form.status),
    };

    void run(async () => {
      if (editing) await app.updateAppointment(editing.id, input);
      else await app.createAppointment(input);
      // Mexer num atendimento pode mudar a lista de conferência — cancelar o
      // que veio pelo link, por exemplo, tira ele de lá.
      await loadIncoming();
      setOpen(false);
    });
  };

  /** Registrar o que entrou é o gesto mais repetido do dia: um toque, sem pergunta. */
  const settle = (appointment: Appointment) => {
    void run(async () => {
      await app.settleAppointment(appointment.id);
      // Dar baixa fecha o atendimento; ele sai da lista de conferência junto.
      await loadIncoming();
    });
  };

  const remove = () => {
    if (!editing) return;
    void run(async () => {
      await app.removeAppointment(editing.id);
      await loadIncoming();
      setOpen(false);
    });
  };

  const dateLabel = app.agendaDay.toDateString() === today.toDateString()
    ? 'Hoje'
    : app.agendaDay.toLocaleDateString('pt-BR', { weekday: 'long' });

  return <Screen>
    <ScreenHeader title="Agenda" subtitle="Seus atendimentos e o que entrou por eles" onBack={onBack} />

    <HeroCard
      label={`Recebido ${dateLabel.toLowerCase()}`}
      value={formatCents(summary?.receivedCents ?? 0)}
      caption={`${summary?.appointments ?? 0} ${summary?.appointments === 1 ? 'atendimento' : 'atendimentos'} · ${formatCents(summary?.expectedCents ?? 0)} combinados`}
      hint={summary && summary.pendingCents > 0 ? `${formatCents(summary.pendingCents)} ainda a receber` : 'Nada em aberto neste dia'}
    />

    <View style={s.meta}>
      <Text style={s.month}>{app.agendaDay.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</Text>
      <Text style={s.metaHint}>{summary ? `${Math.round(summary.occupiedMinutes / 6) / 10} h ocupadas` : ''}</Text>
    </View>
    <WeekStrip
      dates={week}
      selected={selectedDay === -1 ? today.getDay() : selectedDay}
      onSelect={index => void app.showAgendaDay(week[index])}
    />

    {error && !open && <Notice message={error} />}

    {toReview.length > 0 && <>
      <Section title="Marcados pelo seu link" />
      <Text style={s.reviewHint}>
        {toReview.length === 1 ? 'Uma cliente marcou sozinha e ainda não foi confirmada.' : `${toReview.length} clientes marcaram sozinhas e ainda não foram confirmadas.`}
      </Text>
      {toReview.map(appointment => (
        <Card key={appointment.id}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ver ${appointment.clientName} na agenda de ${dateOf(appointment.startsAt)}`}
            onPress={() => void app.showAgendaDay(new Date(appointment.startsAt))}
            style={({ pressed }) => [s.pendingRow, pressed && ui.pressed]}
          >
            <View style={ui.grow}>
              <Text style={ui.rowTitle}>{appointment.clientName}</Text>
              <Text style={ui.rowSub}>
                {dateOf(appointment.startsAt)} às {hourOf(appointment.startsAt)} · {app.services.find(item => item.id === appointment.serviceId)?.name ?? 'Sem serviço'} · {formatCents(appointment.priceCents)}
              </Text>
              {appointment.clientPhone && <Text style={ui.rowSub}>{formatPhone(appointment.clientPhone)}</Text>}
            </View>
            <Badge label="Pelo link" tone="lilac" />
          </Pressable>
          <Row>
            <View style={ui.grow}>
              <Button label={busy ? 'Confirmando...' : 'Confirmar'} icon="check" onPress={busy ? undefined : () => confirmBooking(appointment)} />
            </View>
            {appointment.clientPhone && <View style={ui.grow}>
              <Button label="Falar no WhatsApp" icon="users" secondary onPress={() => openContact(whatsappUrl(appointment.clientPhone ?? ''))} />
            </View>}
          </Row>
        </Card>
      ))}
    </>}

    <TimelinePanel title={`${dateLabel}, ${app.agendaDay.getDate()}`} onAdd={startNew}>
      {app.appointments.length === 0
        ? <EmptyState
            icon="calendar"
            title="Nenhum atendimento neste dia"
            description="Marque o primeiro para acompanhar quanto entrou."
            action="Marcar atendimento"
            onAction={startNew}
          />
        : app.appointments.map((appointment, index) => (
          <TimelineRow
            key={appointment.id}
            time={hourOf(appointment.startsAt)}
            endTime={endOf(appointment.startsAt, appointment.durationMinutes)}
            initials={initialsOf(appointment.clientName)}
            title={appointment.clientName}
            subtitle={`${app.services.find(item => item.id === appointment.serviceId)?.name ?? 'Sem serviço'} · ${formatCents(appointment.priceCents)}`}
            status={statusTextOf(appointment)}
            tag={appointment.source === 'ONLINE' ? 'Pelo link' : undefined}
            pending={appointment.pendingCents > 0}
            last={index === app.appointments.length - 1}
            onPress={() => startEdit(appointment)}
          />
        ))}
    </TimelinePanel>

    {app.appointments.some(item => item.pendingCents > 0) && <>
      <Section title="A receber neste dia" />
      {app.appointments.filter(item => item.pendingCents > 0 && item.status !== 'CANCELED' && item.status !== 'NO_SHOW').map(appointment => (
        <Card key={appointment.id}>
          <View style={s.pendingRow}>
            <View style={ui.grow}>
              <Text style={ui.rowTitle}>{appointment.clientName}</Text>
              <Text style={ui.rowSub}>{hourOf(appointment.startsAt)} · {formatCents(appointment.pendingCents)} em aberto</Text>
            </View>
            <Badge label={labelOfStatus(appointment.status)} tone={appointment.status === 'DONE' ? 'success' : 'warning'} />
          </View>
          <Button label={busy ? 'Registrando...' : 'Recebi o pagamento'} icon="check" secondary onPress={busy ? undefined : () => settle(appointment)} />
        </Card>
      ))}
    </>}

    <Section title="Agenda online" />
    <ListRow
      icon="calendar"
      title="Link da agenda online"
      subtitle="Suas clientes marcam sozinhas, sem instalar o aplicativo"
      onPress={() => onAction?.('booking')}
    />

    <Section title="Resumo do dia" />
    <Row>
      <StatCard icon="wallet" label="Recebido" value={formatCents(summary?.receivedCents ?? 0)} caption="Já entrou" />
      <StatCard icon="clock" label="A receber" value={formatCents(summary?.pendingCents ?? 0)} caption="Combinado em aberto" tone="lilac" />
    </Row>

    <Button label="Marcar atendimento" icon="plus" onPress={startNew} />

    <FormSheet
      visible={open}
      title={editing ? 'Editar atendimento' : 'Novo atendimento'}
      subtitle={app.agendaDay.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
      busy={busy}
      error={error}
      onClose={() => setOpen(false)}
      onSubmit={submit}
      onDelete={editing ? remove : undefined}
      deleteQuestion={editing ? `Remover ${editing.clientName} da agenda deste dia?` : undefined}
    >
      <Field label="Nome da cliente" value={form.clientName} onChangeText={value => setForm({ ...form, clientName: value })} placeholder="Ex.: Mariana Souza" />
      {app.services.length > 0 && <ChoiceField label="Serviço" items={serviceNames} value={form.service} onChange={chooseService} />}
      <Row>
        <View style={ui.grow}><Field label="Horário" value={form.time} onChangeText={value => setForm({ ...form, time: value })} placeholder="09:00" /></View>
        <View style={ui.grow}><Field label="Duração (min)" value={form.duration} onChangeText={value => setForm({ ...form, duration: value })} numeric /></View>
      </Row>
      <Field label="Valor combinado" value={form.price} onChangeText={value => setForm({ ...form, price: value })} prefix="R$" numeric />
      <ChoiceField label="Situação" items={STATUS.map(item => item.label)} value={form.status} onChange={value => setForm({ ...form, status: value })} />
      {editing?.source === 'ONLINE' && <Notice tone="success" message="Esta cliente marcou sozinha, pelo seu link da agenda online." />}
      {editing?.clientPhone && <ClientContact phone={editing.clientPhone} onOpen={openContact} />}
      {editing && editing.paidCents > 0 && <Notice tone="success" message={`Já recebido: ${formatCents(editing.paidCents)}.`} />}
    </FormSheet>
  </Screen>;
}

/**
 * Contato de quem marcou pelo link.
 *
 * Quem chega pela agenda pública não tem conta no BeautyConta: este telefone é
 * o único caminho de volta até ela, e por isso vira ação e não só texto.
 */
function ClientContact({ phone, onOpen }: { phone: string; onOpen: (url: string | null) => void }) {
  return <View style={s.contact}>
    <Text style={ui.groupLabel}>Contato da cliente</Text>
    <Text style={s.phone}>{formatPhone(phone)}</Text>
    <Row>
      <View style={ui.grow}><Button label="Falar no WhatsApp" icon="users" secondary onPress={() => onOpen(whatsappUrl(phone))} /></View>
      <View style={ui.grow}><Button label="Ligar" icon="bell" secondary onPress={() => onOpen(telUrl(phone))} /></View>
    </Row>
  </View>;
}

/** Dia e mês curtos: a lista de conferência quase sempre fala de outra data. */
const dateOf = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

function statusTextOf(appointment: Appointment): string {
  if (appointment.status === 'CANCELED') return 'Cancelado';
  if (appointment.status === 'NO_SHOW') return 'Não veio';
  if (appointment.pendingCents === 0 && appointment.paidCents > 0) return `Pago · ${formatCents(appointment.paidCents)}`;
  if (appointment.paidCents > 0) return `Parcial · falta ${formatCents(appointment.pendingCents)}`;
  return appointment.status === 'CONFIRMED' ? 'Confirmado' : 'A receber';
}

const s = StyleSheet.create({
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 13 },
  month: { color: colors.muted, fontSize: 11, textTransform: 'capitalize' },
  metaHint: { color: colors.muted, fontSize: 10 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewHint: { color: colors.ink3, fontSize: 12, lineHeight: 18, marginBottom: 11 },
  contact: { gap: 7 },
  phone: { color: colors.ink, fontSize: 15, fontWeight: '600' },
});
