import { colors } from '../theme';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Appointment, AppointmentStatus } from '../lib/resources';
import { centsToInput, formatCents, parseCents, parseNumber, useSubmit } from '../lib/useSubmit';
import { useApp } from '../state/AppProvider';
import {
  Badge,
  Button,
  Card,
  ChoiceField,
  EmptyState,
  Field,
  FormSheet,
  HeroCard,
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

export function AgendaScreen({ onBack }: { onBack?: () => void; onAction?: (action: string) => void }) {
  const app = useApp();
  const { busy, error, setError, clear, run } = useSubmit();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [form, setForm] = useState(emptyForm);

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
      setOpen(false);
    });
  };

  /** Registrar o que entrou é o gesto mais repetido do dia: um toque, sem pergunta. */
  const settle = (appointment: Appointment) => {
    void run(() => app.settleAppointment(appointment.id));
  };

  const remove = () => {
    if (!editing) return;
    void run(async () => {
      await app.removeAppointment(editing.id);
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
      {editing && editing.paidCents > 0 && <Notice tone="success" message={`Já recebido: ${formatCents(editing.paidCents)}.`} />}
    </FormSheet>
  </Screen>;
}

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
});
