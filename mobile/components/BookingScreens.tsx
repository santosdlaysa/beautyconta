import { colors } from '../theme';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ApiError } from '../lib/api';
import {
  bookingUrl,
  formatMinutes,
  parseMinutes,
  rangesFromApi,
  rangesOfDay,
  sortRanges,
  suggestRange,
  validateWeek,
  WEEKDAYS,
  WORKING_WEEKDAYS,
  type WorkRange,
} from '../lib/booking';
import { forgetBookingToken, readBookingToken, rememberBookingToken } from '../lib/bookingToken';
import {
  disableBookingLink,
  enableBookingLink,
  getBookingPage,
  getBusinessHours,
  regenerateBookingLink,
  saveBusinessHours,
  type BookingPage,
} from '../lib/resources';
import { formatCents, useSubmit } from '../lib/useSubmit';
import { message, useApp } from '../state/AppProvider';
import { Icon } from './AppChrome';
import { useDialog } from './Dialog';
import {
  Button,
  Card,
  EmptyState,
  Field,
  FormSheet,
  HeroCard,
  ListRow,
  Loading,
  Notice,
  Row,
  Screen,
  ScreenHeader,
  Section,
  ui,
} from './ui';

/**
 * As duas telas da agenda pública, do lado de quem atende.
 *
 * A cliente marca no site, sem instalar nada. Aqui a profissional decide as
 * duas coisas de que aquela página depende: **quando** ela atende e **quem**
 * tem o endereço. Uma sem a outra não agenda ninguém — sem expediente a página
 * não mostra horário, e sem link ninguém chega até ela —, e por isso cada tela
 * aponta para a que falta.
 */

type ScreenProps = { onBack?: () => void; onAction?: (action: string) => void };

// ---------------------------------------------------------------------------
// Expediente
// ---------------------------------------------------------------------------

type RangeForm = { weekday: number; original: WorkRange | null; start: string; end: string };

const isWorkingWeekday = (weekday: number): boolean =>
  (WORKING_WEEKDAYS as readonly number[]).includes(weekday);

/**
 * Expediente da semana.
 *
 * O dia com duas faixas — manhã, almoço, tarde — é o caso normal, não a
 * exceção, então cada dia é uma lista e não um par de campos.
 *
 * A gravação substitui a semana inteira no servidor. Por isso a tela edita uma
 * cópia local e sobe tudo de uma vez ao salvar: assim o que está na tela é
 * exatamente o que fica gravado, sem um passo no meio em que metade da semana
 * já subiu e a outra metade não.
 */
export function BusinessHoursScreen({ onBack, onAction }: ScreenProps) {
  const app = useApp();
  const { busy, error, setError, clear, run } = useSubmit();
  const [ranges, setRanges] = useState<WorkRange[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<RangeForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const token = app.token;
  const business = app.business;

  const load = useCallback(async () => {
    if (!token || !business) return;
    setLoadError(null);
    try {
      setRanges(rangesFromApi(await getBusinessHours({ token, businessId: business.id })));
      setDirty(false);
      setSaved(false);
    } catch (failure) {
      setLoadError(message(failure));
    }
  }, [token, business]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Toda mudança é local até a usuária salvar; o aviso de pendência sai daqui. */
  const change = (next: WorkRange[]) => {
    setRanges(sortRanges(next));
    setDirty(true);
    setSaved(false);
    clear();
  };

  const openNew = (weekday: number) => {
    const suggestion = suggestRange(rangesOfDay(ranges ?? [], weekday));
    setFormError(null);
    setForm({
      weekday,
      original: null,
      start: formatMinutes(suggestion.startMinute),
      end: formatMinutes(suggestion.endMinute),
    });
  };

  const openEdit = (range: WorkRange) => {
    setFormError(null);
    setForm({
      weekday: range.weekday,
      original: range,
      start: formatMinutes(range.startMinute),
      end: formatMinutes(range.endMinute),
    });
  };

  const applyRange = () => {
    if (!form || !ranges) return;

    const startMinute = parseMinutes(form.start);
    const endMinute = parseMinutes(form.end);
    if (startMinute === null || endMinute === null) {
      setFormError('Escreva o horário no formato HH:MM, como 09:00.');
      return;
    }
    if (endMinute <= startMinute) {
      setFormError('O fim precisa ser depois do início.');
      return;
    }

    const others = ranges.filter((item) => item !== form.original);
    const updated = [...others, { weekday: form.weekday, startMinute, endMinute }];

    // O servidor recusa sobreposição com 422; conferir aqui faz a mensagem
    // aparecer enquanto a usuária ainda olha para o horário que digitou.
    const problem = validateWeek(updated);
    if (problem) {
      setFormError(problem);
      return;
    }

    change(updated);
    setForm(null);
  };

  const removeRange = () => {
    if (!form?.original || !ranges) return;
    change(ranges.filter((item) => item !== form.original));
    setForm(null);
  };

  /** Segunda a sexta com o mesmo expediente é o comum; copiar poupa quatro cadastros. */
  const repeatOnWeekdays = (weekday: number) => {
    if (!ranges) return;

    const day = rangesOfDay(ranges, weekday);
    const copies = WORKING_WEEKDAYS.filter((target) => target !== weekday).flatMap((target) =>
      day.map((range) => ({ weekday: target, startMinute: range.startMinute, endMinute: range.endMinute })),
    );

    // Os outros dias úteis são substituídos, não somados: repetir precisa
    // deixar a semana igual ao dia copiado, e somar criaria sobreposição.
    const kept = ranges.filter((range) => range.weekday === weekday || !isWorkingWeekday(range.weekday));
    change([...kept, ...copies]);
  };

  const save = () => {
    if (!token || !business || !ranges) return;

    const problem = validateWeek(ranges);
    if (problem) {
      setError(problem);
      return;
    }

    void run(async () => {
      const updated = await saveBusinessHours({ token, businessId: business.id }, ranges);
      setRanges(rangesFromApi(updated));
      setDirty(false);
      setSaved(true);
    });
  };

  const total = ranges?.length ?? 0;
  const openDays = new Set((ranges ?? []).map((range) => range.weekday)).size;

  return <Screen>
    <ScreenHeader title="Meu expediente" subtitle="Os horários em que sua agenda online oferece vaga" onBack={onBack} />

    {ranges === null
      ? loadError
        ? <>
            <Notice message={loadError} />
            <Button label="Tentar de novo" icon="arrow" onPress={() => void load()} />
          </>
        : <Loading label="Carregando seu expediente..." />
      : <>
        <HeroCard
          label="Semana cadastrada"
          value={total === 0 ? 'Nenhum horário' : `${openDays} ${openDays === 1 ? 'dia aberto' : 'dias abertos'}`}
          caption={total === 0 ? 'Nenhuma faixa cadastrada' : `${total} ${total === 1 ? 'faixa de atendimento' : 'faixas de atendimento'}`}
          hint="A cliente só consegue marcar dentro do que estiver aqui"
        />

        {saved && <Notice tone="success" message="Expediente salvo. Sua agenda online já oferece estes horários." />}
        {dirty && <Notice tone="warning" message="Você mudou o expediente e ainda não salvou." />}
        {error && <Notice message={error} />}

        {total === 0 && !dirty && <EmptyState
          icon="clock"
          title="Nenhum horário cadastrado"
          description="Cadastre os horários em que você atende. Sem isso, quem abrir seu link não encontra nenhuma vaga para escolher."
        />}

        <Section title="Dias da semana" />
        {WEEKDAYS.map((label, weekday) => {
          const day = rangesOfDay(ranges, weekday);
          return <Card key={label}>
            <View style={s.dayHead}>
              <View style={ui.grow}><Text style={ui.rowTitle}>{label}</Text></View>
              <Text style={ui.rowSub}>{day.length === 0 ? 'Fechado' : `${day.length} ${day.length === 1 ? 'horário' : 'horários'}`}</Text>
            </View>

            {day.map((range) => (
              <Pressable
                key={`${range.startMinute}-${range.endMinute}`}
                accessibilityRole="button"
                accessibilityLabel={`Editar ${label}, das ${formatMinutes(range.startMinute)} às ${formatMinutes(range.endMinute)}`}
                onPress={() => openEdit(range)}
                style={({ pressed }) => [s.range, pressed && ui.pressed]}
              >
                <Icon name="clock" size={17} color={colors.accent} />
                <Text style={s.rangeText}>{formatMinutes(range.startMinute)} às {formatMinutes(range.endMinute)}</Text>
                <Icon name="chevron" size={14} color={colors.outline} />
              </Pressable>
            ))}

            <Button label="Adicionar horário" icon="plus" secondary onPress={() => openNew(weekday)} />

            {day.length > 0 && isWorkingWeekday(weekday) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Repetir o expediente de ${label} de segunda a sexta`}
                onPress={() => repeatOnWeekdays(weekday)}
                style={({ pressed }) => [s.repeat, pressed && ui.pressed]}
              >
                <Text style={ui.link}>Repetir de segunda a sexta</Text>
              </Pressable>
            )}
          </Card>;
        })}

        <Button label={busy ? 'Salvando...' : 'Salvar expediente'} icon="check" onPress={busy ? undefined : save} />
        <Text style={s.footnote}>Salvar substitui a semana inteira: fica gravado exatamente o que está nesta tela.</Text>

        <Section title="Agenda online" />
        <ListRow
          icon="calendar"
          title="Link da agenda online"
          subtitle="Onde suas clientes marcam sozinhas"
          onPress={() => onAction?.('booking')}
        />
      </>}

    <FormSheet
      visible={form !== null}
      title={form?.original ? 'Editar horário' : 'Novo horário'}
      subtitle={form ? WEEKDAYS[form.weekday] : undefined}
      submitLabel="Aplicar"
      error={formError}
      onClose={() => setForm(null)}
      onSubmit={applyRange}
      onDelete={form?.original ? removeRange : undefined}
      deleteLabel="Remover horário"
      deleteQuestion="Tirar este horário do expediente?"
    >
      <Row>
        <View style={ui.grow}>
          <Field
            label="Início"
            value={form?.start ?? ''}
            onChangeText={(value) => setForm((current) => (current ? { ...current, start: value } : current))}
            placeholder="09:00"
          />
        </View>
        <View style={ui.grow}>
          <Field
            label="Fim"
            value={form?.end ?? ''}
            onChangeText={(value) => setForm((current) => (current ? { ...current, end: value } : current))}
            placeholder="12:00"
          />
        </View>
      </Row>
      <Text style={s.hint}>Para parar no almoço, cadastre duas faixas no mesmo dia: uma de manhã e outra à tarde.</Text>
    </FormSheet>
  </Screen>;
}

// ---------------------------------------------------------------------------
// Link da agenda pública
// ---------------------------------------------------------------------------

type Feedback = { tone: 'success' | 'warning'; text: string };

/**
 * O link que a profissional divulga.
 *
 * O servidor liga, troca e desliga o link, mas não tem rota que diga qual é o
 * link de agora. Por isso o endereço fica guardado no aparelho e é **conferido
 * contra a página pública** ao abrir esta tela: se ele não abre mais, some
 * daqui em vez de continuar sendo divulgado.
 */
export function BookingLinkScreen({ onBack, onAction }: ScreenProps) {
  const app = useApp();
  const dialog = useDialog();
  const { busy, error, setError, clear, run } = useSubmit();
  const [checking, setChecking] = useState(true);
  const [bookingToken, setBookingToken] = useState<string | null>(null);
  const [page, setPage] = useState<BookingPage | null>(null);
  const [hours, setHours] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const token = app.token;
  const business = app.business;
  const url = useMemo(() => (bookingToken ? bookingUrl(bookingToken) : null), [bookingToken]);

  const check = useCallback(async () => {
    if (!token || !business) return;
    setChecking(true);
    setError(null);

    // O expediente vem junto porque é ele que decide se a página tem horário
    // para oferecer; divulgar um link que não mostra vaga nenhuma é pior que
    // não divulgar.
    void getBusinessHours({ token, businessId: business.id })
      .then((items) => setHours(items.length))
      .catch(() => setHours(null));

    const stored = await readBookingToken(business.id);
    if (!stored) {
      setBookingToken(null);
      setPage(null);
      setChecking(false);
      return;
    }

    try {
      setPage(await getBookingPage(stored));
      setBookingToken(stored);
      setExpired(false);
    } catch (failure) {
      // A rota pública responde 404 tanto para link desconhecido quanto para
      // agenda desligada: nos dois casos o endereço guardado não serve mais.
      if (failure instanceof ApiError && failure.status === 404) {
        await forgetBookingToken(business.id);
        setBookingToken(null);
        setPage(null);
        setExpired(true);
      } else {
        setError(message(failure));
      }
    } finally {
      setChecking(false);
    }
  }, [token, business, setError]);

  useEffect(() => {
    void check();
  }, [check]);

  const remember = async (created: string) => {
    if (!business) return;
    await rememberBookingToken(business.id, created);
    setBookingToken(created);
    setExpired(false);
    // A página pública é o retrato do que a cliente vê; não conseguir lê-la
    // agora não invalida o link recém-criado.
    setPage(await getBookingPage(created).catch(() => null));
  };

  const enable = () => {
    if (!token || !business) return;
    setFeedback(null);
    void run(async () => {
      const { bookingToken: created } = await enableBookingLink({ token, businessId: business.id });
      await remember(created);
    });
  };

  const copy = () => {
    if (!url) return;
    void (async () => {
      // Na web o navegador pode recusar a área de transferência, e o retorno
      // falso é a única forma de saber. Dizer "copiado" sem isso faria a
      // profissional colar na conversa o que estava antes no aparelho.
      const done = await Clipboard.setStringAsync(url).catch(() => false);
      setFeedback(done
        ? { tone: 'success', text: 'Link copiado. É só colar na conversa.' }
        : { tone: 'warning', text: 'Não conseguimos copiar por aqui. Toque no endereço acima e copie com o dedo.' });
    })();
  };

  const share = () => {
    if (!url) return;
    setFeedback(null);
    // Navegador de computador costuma não ter compartilhamento; copiar atende à
    // mesma necessidade e evita um botão que não faz nada.
    void Share.share({ message: `Agende comigo pelo BeautyConta: ${url}`, url }).catch(() => copy());
  };

  const confirmRegenerate = () => {
    if (!token || !business) return;
    dialog.confirm({
      title: 'Trocar o link',
      message: 'O endereço atual para de funcionar na hora. Quem tiver o link antigo — inclusive quem você já mandou por mensagem — não vai mais conseguir marcar e precisará do endereço novo. Os atendimentos já marcados continuam na sua agenda.',
      confirmLabel: 'Trocar o link',
      destructive: true,
      onConfirm: () => {
        setFeedback(null);
        void run(async () => {
          const { bookingToken: created } = await regenerateBookingLink({ token, businessId: business.id });
          await remember(created);
          setFeedback({ tone: 'success', text: 'Link trocado. Divulgue o endereço novo: o anterior não funciona mais.' });
        });
      },
    });
  };

  const confirmDisable = () => {
    if (!token || !business) return;
    dialog.confirm({
      title: 'Desligar a agenda online',
      message: 'Ninguém mais consegue marcar pelo link, e quem tiver o endereço vai encontrar uma página que não abre. Os atendimentos já marcados continuam na sua agenda.',
      confirmLabel: 'Desligar',
      destructive: true,
      onConfirm: () => {
        setFeedback(null);
        void run(async () => {
          await disableBookingLink({ token, businessId: business.id });
          await forgetBookingToken(business.id);
          setBookingToken(null);
          setPage(null);
          setExpired(false);
        });
      },
    });
  };

  const bookable = page?.services.length ?? 0;
  const hoursLabel = hours === null
    ? 'Os horários em que você atende'
    : hours === 0
      ? 'Nenhum horário cadastrado'
      : `${hours} ${hours === 1 ? 'faixa cadastrada' : 'faixas cadastradas'}`;

  return <Screen>
    <ScreenHeader title="Agenda online" subtitle="O endereço que suas clientes abrem para marcar" onBack={onBack} />

    {checking
      ? <Loading label="Conferindo seu link..." />
      : <>
        {error && <Notice message={error} action="Tentar de novo" onAction={() => { clear(); void check(); }} />}
        {expired && <Notice
          tone="warning"
          message="O link guardado neste aparelho não funciona mais — a agenda online foi desligada ou o endereço foi trocado. Ligue de novo para gerar um link."
        />}

        {url !== null
          ? <>
            <HeroCard
              label="Agenda online"
              value="Ligada"
              caption={page?.businessName ?? business?.name ?? 'Seu negócio'}
              hint={`${bookable} ${bookable === 1 ? 'serviço aparece' : 'serviços aparecem'} para a cliente escolher`}
            />

            <Card>
              <Text style={s.linkLabel}>Seu link</Text>
              <Text accessibilityLabel={`Link da sua agenda online: ${url}`} selectable style={s.link}>{url}</Text>
            </Card>

            {feedback && <Notice tone={feedback.tone} message={feedback.text} />}

            <Button label="Copiar link" icon="check" onPress={copy} />
            <Button label="Compartilhar" icon="arrow" secondary onPress={share} />

            <Section title="Antes de divulgar" />
            {hours === 0 && <Notice
              tone="warning"
              message="Você ainda não cadastrou o expediente. Sem ele, sua página abre sem nenhum horário para escolher."
              action="Cadastrar"
              onAction={() => onAction?.('hours')}
            />}
            {bookable === 0 && <Notice
              tone="warning"
              message="Nenhum serviço seu tem preço definido, e a página só oferece serviço com preço. Defina o preço para a cliente poder escolher."
              action="Ver serviços"
              onAction={() => onAction?.('services')}
            />}

            <ListRow icon="clock" title="Meu expediente" subtitle={hoursLabel} onPress={() => onAction?.('hours')} />

            {bookable > 0 && <>
              <Section title="O que a cliente vê" />
              {page?.services.map((service) => (
                <ListRow
                  key={service.id}
                  icon="tag"
                  title={service.name}
                  subtitle={`${service.durationMinutes} min · ${formatCents(service.priceCents ?? 0)}`}
                />
              ))}
            </>}

            <Section title="Cuidados com o link" />
            <ListRow
              icon="edit"
              title="Trocar o link"
              subtitle="Gera outro endereço e derruba o atual na hora"
              onPress={busy ? undefined : confirmRegenerate}
            />
            <ListRow
              icon="alert"
              iconTone="danger"
              title="Desligar a agenda online"
              subtitle="Ninguém mais marca pelo link"
              onPress={busy ? undefined : confirmDisable}
            />
          </>
          : <>
            <EmptyState
              icon="calendar"
              title="Nenhum link neste aparelho"
              description="Ligue a agenda online para gerar o endereço que suas clientes abrem para marcar sozinhas, sem instalar o aplicativo. Se você já ligou em outro aparelho, o mesmo endereço volta para cá."
              action={busy ? 'Ligando...' : 'Ligar agenda online'}
              onAction={busy ? undefined : enable}
            />
            <ListRow icon="clock" title="Meu expediente" subtitle={hoursLabel} onPress={() => onAction?.('hours')} />
          </>}
      </>}
  </Screen>;
}

const s = StyleSheet.create({
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  range: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingHorizontal: 13, borderRadius: 15, backgroundColor: colors.softLilac },
  rangeText: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '600' },
  repeat: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  footnote: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  linkLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  link: { color: colors.ink, fontSize: 14, fontWeight: '600', lineHeight: 21 },
});
