import { colors } from '../theme';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../lib/api';
import {
  MAX_USEFUL_LIFE_MONTHS,
  MIN_USEFUL_LIFE_MONTHS,
  SHORT_LIFE_MONTHS,
  isReserveComplete,
  monthlyReserveCents,
  totalMonthlyReserveCents,
} from '../lib/equipment';
import {
  createEquipment,
  deleteEquipment,
  listEquipment,
  listEquipmentTypes,
  updateEquipment,
  type CatalogItem,
  type Equipment,
} from '../lib/resources';
import {
  centsToInput,
  formatCents,
  formatIsoDate,
  parseCents,
  parseIsoDate,
  parseNumber,
  useSubmit,
} from '../lib/useSubmit';
import { message, useApp } from '../state/AppProvider';
import {
  Badge,
  Button,
  ChoiceField,
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
  StatCard,
  ui,
} from './ui';

/**
 * Equipamentos do documento 07.
 *
 * A tela deixou de ser um cadastro solto: desde que a reserva para reposição
 * entrou no custo fixo, cada linha daqui empurra o preço de todos os serviços
 * para cima. Por isso a lista mostra quanto cada equipamento reserva por mês e
 * quanto eles somam — a seção 11 do documento avisa que o risco desta
 * funcionalidade é a sensação de preço inflado, e a defesa contra ela é mostrar
 * a conta, não escondê-la.
 *
 * O nome do equipamento **é** o tipo escolhido: a lista de tipos vem do
 * servidor com rótulo pronto, e quem tem duas iguais separa uma da outra pelo
 * complemento — a tela sugere um número quando percebe a repetição, para que
 * nenhuma linha fique impossível de identificar.
 *
 * Os dados não passam pelo `AppProvider`: quem soma a reserva no preço é o
 * servidor, e uma requisição na abertura do aplicativo por causa de uma tela
 * que muitas nunca abrem não pagaria o que mostra.
 */

type Props = { onBack?: () => void };

/** Campos que o servidor sabe recusar, e que a tela sabe destacar. */
type FormField = 'price' | 'residual' | 'life' | 'date';

/** Nome do campo no `422` do servidor traduzido para o campo da folha. */
const FIELD_OF: Record<string, FormField> = {
  acquisitionPriceCents: 'price',
  residualValueCents: 'residual',
  usefulLifeMonths: 'life',
  acquisitionDate: 'date',
};

const emptyForm = { type: '', complement: '', price: '', residual: '', life: '24', date: '' };

/** Hoje em `AAAA-MM-DD`, no fuso do aparelho: é com esta data que a compra é comparada. */
const todayIso = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * O nome que vai para o servidor: o rótulo do tipo, mais o complemento.
 *
 * O corte em 120 caracteres é o limite que a API aceita — melhor encurtar aqui
 * do que devolver uma recusa que a usuária não teria como adivinhar.
 */
const nameOf = (typeLabel: string, complement: string): string =>
  [typeLabel.trim(), complement.trim()].filter(Boolean).join(' ').slice(0, 120);

/**
 * Separa o complemento do rótulo ao abrir um equipamento para editar.
 *
 * Quando o nome não começa pelo rótulo — o caso de quem cadastrou antes, com
 * nome livre —, o nome inteiro vira complemento: some da tela é o que não pode
 * acontecer com algo que a usuária escreveu.
 */
const complementOf = (name: string, typeLabel: string): string =>
  name.startsWith(typeLabel) ? name.slice(typeLabel.length).trim() : name.trim();

export function EquipmentScreen({ onBack }: Props) {
  const app = useApp();
  const { busy, error, setError, clear, run } = useSubmit();
  const [list, setList] = useState<Equipment[] | null>(null);
  const [types, setTypes] = useState<CatalogItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [invalid, setInvalid] = useState<{ field: FormField; message: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const token = app.token;
  const business = app.business;

  const load = useCallback(async () => {
    if (!token || !business) return;
    setLoadError(null);
    try {
      // Os tipos vêm junto da lista porque um depende do outro para ser lido: o
      // que está guardado é o identificador, e o nome legível está no catálogo.
      const [saved, catalog] = await Promise.all([
        listEquipment({ token, businessId: business.id }),
        listEquipmentTypes(),
      ]);
      setList(saved);
      setTypes(catalog);
      // Catálogo vazio não é lista vazia: sem os tipos não há nome para
      // cadastrar, e a tela precisa oferecer uma nova tentativa em vez de
      // ficar girando.
      if (catalog.length === 0) {
        setLoadError('Não conseguimos carregar os tipos de equipamento agora.');
      }
    } catch (failure) {
      setLoadError(message(failure));
    }
  }, [token, business]);

  useEffect(() => {
    void load();
  }, [load]);

  const labelOfType = useCallback(
    (slug: string) => types?.find((item) => item.slug === slug)?.label ?? slug,
    [types],
  );

  /**
   * O identificador do tipo escolhido.
   *
   * Recua para o tipo que o equipamento já tinha quando o rótulo não está no
   * catálogo — um tipo que saiu da lista não pode virar motivo de recusa ao
   * editar o preço de algo que já estava cadastrado.
   */
  const slugOfLabel = useCallback(
    (label: string, fallback?: string) =>
      types?.find((item) => item.label === label)?.slug ?? fallback ?? '',
    [types],
  );

  const active = useMemo(() => (list ?? []).filter((item) => !item.isArchived), [list]);
  const invested = active.reduce((sum, item) => sum + item.acquisitionPriceCents, 0);
  const reserveTotal = totalMonthlyReserveCents(active);
  const finished = active.filter((item) => isReserveComplete(item)).length;

  /**
   * Sugere um complemento quando o tipo escolhido já está na lista.
   *
   * Duas cabines com o mesmo nome deixariam a usuária sem saber qual é qual —
   * e ela vai precisar saber no dia em que uma das duas quebrar. O número é só
   * um ponto de partida: "da bancada" ou "a antiga" dizem mais, e o campo fica
   * aberto para isso.
   */
  const suggestComplement = useCallback(
    (typeLabel: string, ignoreId?: string): string => {
      const sameType = active.filter(
        (item) => item.id !== ignoreId && labelOfType(item.type) === typeLabel,
      );
      return sameType.length === 0 ? '' : String(sameType.length + 1);
    },
    [active, labelOfType],
  );

  const startNew = () => {
    const firstType = types?.[0]?.label ?? '';
    setEditing(null);
    setForm({ ...emptyForm, type: firstType, complement: suggestComplement(firstType) });
    setInvalid(null);
    clear();
    setDone(null);
    setOpen(true);
  };

  const startEdit = (item: Equipment) => {
    const typeLabel = labelOfType(item.type);
    setEditing(item);
    setForm({
      type: typeLabel,
      complement: complementOf(item.name, typeLabel),
      price: centsToInput(item.acquisitionPriceCents),
      residual: item.residualValueCents > 0 ? centsToInput(item.residualValueCents) : '',
      life: String(item.usefulLifeMonths),
      date: formatIsoDate(item.acquisitionDate),
    });
    setInvalid(null);
    clear();
    setDone(null);
    setOpen(true);
  };

  /** Trocar o tipo troca o nome: o complemento sugerido acompanha. */
  const chooseType = (typeLabel: string) => {
    const suggested = suggestComplement(typeLabel, editing?.id);
    const wasSuggested = form.complement === '' || /^\d+$/.test(form.complement);
    setForm({ ...form, type: typeLabel, complement: wasSuggested ? suggested : form.complement });
  };

  const change = (values: Partial<typeof form>, field?: FormField) => {
    if (field && invalid?.field === field) setInvalid(null);
    setForm({ ...form, ...values });
  };

  const errorOf = (field: FormField) => (invalid?.field === field ? invalid.message : null);

  const submit = () => {
    const price = parseCents(form.price);
    const residual = parseCents(form.residual);
    const life = parseNumber(form.life);
    const acquisitionDate = parseIsoDate(form.date);

    // As mesmas quatro regras da seção 8 do documento 07, conferidas antes de
    // subir: a viagem até o servidor só para ouvir "revenda maior que a compra"
    // é tempo que a usuária perde sem aprender nada de novo.
    setError(null);
    if (price <= 0) {
      setInvalid({ field: 'price', message: 'O valor de compra precisa ser maior que zero.' });
      return;
    }
    if (residual >= price) {
      setInvalid({
        field: 'residual',
        message: 'O valor de revenda precisa ser menor que o de compra: senão não há desgaste a guardar.',
      });
      return;
    }
    if (!Number.isInteger(life) || life < MIN_USEFUL_LIFE_MONTHS || life > MAX_USEFUL_LIFE_MONTHS) {
      setInvalid({
        field: 'life',
        message: `A vida útil precisa ser um número inteiro de ${MIN_USEFUL_LIFE_MONTHS} a ${MAX_USEFUL_LIFE_MONTHS} meses.`,
      });
      return;
    }
    if (!acquisitionDate) {
      setInvalid({ field: 'date', message: 'Escreva a data da compra no formato DD/MM/AAAA.' });
      return;
    }
    if (acquisitionDate > todayIso()) {
      setInvalid({ field: 'date', message: 'A data da compra não pode estar no futuro.' });
      return;
    }

    // Passou pelas quatro regras: nenhum campo continua marcado.
    setInvalid(null);

    const type = slugOfLabel(form.type, editing?.type);
    if (!type) {
      setError('Escolha qual equipamento é este.');
      return;
    }

    const input = {
      name: nameOf(form.type, form.complement),
      type,
      acquisitionPriceCents: price,
      residualValueCents: residual,
      usefulLifeMonths: life,
      acquisitionDate,
    };

    void run(async () => {
      if (!token || !business) return;
      const scope = { token, businessId: business.id };

      try {
        const saved = editing
          ? await updateEquipment(scope, editing.id, input)
          : await createEquipment(scope, input);

        setList((current) => (editing
          ? (current ?? []).map((item) => (item.id === saved.id ? saved : item))
          : [...(current ?? []), saved]));
        setOpen(false);
        setDone(editing
          ? `"${saved.name}" foi atualizado, e a reserva dele já vale no próximo cálculo.`
          : `"${saved.name}" entrou na sua lista. A reserva dele passa a fazer parte do seu custo fixo — recalcule um serviço para ver a composição do preço.`);
      } catch (failure) {
        // O servidor recusou um campo: a mensagem vai para ele, e não para o
        // topo da folha, senão a usuária lê a regra sem saber o que corrigir.
        const field = failure instanceof ApiError && failure.field ? FIELD_OF[failure.field] : undefined;
        if (field) setInvalid({ field, message: (failure as ApiError).message });
        throw failure;
      }
    });
  };

  const remove = () => {
    const item = editing;
    if (!item || !token || !business) return;

    void run(async () => {
      await deleteEquipment({ token, businessId: business.id }, item.id);
      setList((current) => (current ?? []).filter((other) => other.id !== item.id));
      setOpen(false);
      setDone(`"${item.name}" saiu da sua lista e da sua reserva mensal.`);
    });
  };

  const life = parseNumber(form.life);
  const ready = list !== null && types !== null && types.length > 0;

  return <Screen>
    <ScreenHeader title="Equipamentos" subtitle="O que você comprou para trabalhar" onBack={onBack} />

    {/*
      O total vem antes da lista porque é a resposta que a tela existe para dar:
      quanto os equipamentos pesam por mês. A explicação evita a palavra
      contábil, como manda a seção 3 do documento 07.
    */}
    {ready && active.length > 0 && <HeroCard
      label="Reserva para reposição"
      value={formatCents(reserveTotal)}
      caption="É isto que os seus equipamentos representam por mês"
      hint="Guardando este valor por mês, você consegue repor o equipamento quando ele acabar."
    />}

    <Notice
      tone="lilac"
      message="Esta reserva entra nos seus custos fixos e no cálculo dos seus preços. É uma conta de gestão para o seu planejamento e não substitui a orientação de quem cuida da sua contabilidade."
    />

    {ready && active.length > 0 && <Row>
      <StatCard icon="settings" label="Equipamentos" value={String(active.length)} caption={finished > 0 ? `${finished} com a reserva concluída` : 'Na sua lista'} />
      <StatCard icon="wallet" label="Investido" value={formatCents(invested)} caption="Soma das compras" tone="lilac" />
    </Row>}

    {done && <Notice tone="success" message={done} />}
    {!open && error && <Notice message={error} />}

    {ready && <Button label="Adicionar equipamento" icon="plus" onPress={startNew} />}

    <Section title="Meus equipamentos" first />
    {loadError && <Notice message={loadError} action="Tentar de novo" onAction={() => void load()} />}
    {!ready && !loadError && <Loading label="Buscando os seus equipamentos..." />}
    {ready && active.length === 0 && (
      <EmptyState
        icon="settings"
        title="Nenhum equipamento cadastrado"
        description="Cabine, maca, motor, autoclave: registre o que você comprou e o preço dos seus serviços passa a guardar um pouco por mês para repor cada um."
        action="Adicionar equipamento"
        onAction={startNew}
      />
    )}
    {ready && active.map((item) => {
      const concluida = isReserveComplete(item);
      const reserve = monthlyReserveCents(item);

      return <ListRow
        key={item.id}
        icon="settings"
        title={item.name}
        subtitle={`${formatCents(item.acquisitionPriceCents)} · vida útil de ${item.usefulLifeMonths} ${item.usefulLifeMonths === 1 ? 'mês' : 'meses'} · comprado em ${formatIsoDate(item.acquisitionDate)}`}
        meta={concluida ? undefined : `${formatCents(reserve)}/mês`}
        badge={concluida ? <Badge label="Reserva concluída" tone="warning" /> : undefined}
        onPress={() => startEdit(item)}
      >
        {/* Vencido continua na lista, avisado: sumir com ele deixaria a queda do
            custo fixo sem explicação nenhuma. */}
        {concluida && <Text style={s.rowNote}>
          A vida útil que você informou já passou: ele não soma mais no seu custo fixo.
        </Text>}
      </ListRow>;
    })}

    <FormSheet
      visible={open}
      title={editing ? 'Editar equipamento' : 'Novo equipamento'}
      subtitle="A reserva mensal sai do valor de compra, da revenda esperada e da vida útil."
      busy={busy}
      // Erro de campo aparece no campo; aqui fica só o que não tem dono.
      error={invalid ? null : error}
      onClose={() => setOpen(false)}
      onSubmit={submit}
      onDelete={editing ? remove : undefined}
      deleteQuestion={editing ? `Excluir "${editing.name}" da sua lista de equipamentos?` : undefined}
    >
      <ChoiceField
        label="Qual equipamento"
        items={(types ?? []).map((item) => item.label)}
        value={form.type}
        onChange={chooseType}
        hint="O tipo escolhido é o nome que aparece na sua lista."
      />
      <Field
        label="Complemento"
        value={form.complement}
        onChangeText={(value) => change({ complement: value })}
        placeholder="Ex.: da bancada"
        hint="opcional"
      />
      <Text style={s.hint}>
        Use o complemento para diferenciar duas iguais. Este equipamento vai aparecer como
        “{nameOf(form.type, form.complement) || 'escolha o equipamento acima'}”.
      </Text>
      <Row>
        <View style={ui.grow}>
          <Field
            label="Preço que você pagou"
            value={form.price}
            onChangeText={(value) => change({ price: value }, 'price')}
            prefix="R$"
            placeholder="0,00"
            numeric
            error={errorOf('price')}
          />
        </View>
        <View style={ui.grow}>
          <Field
            label="Valor de revenda"
            value={form.residual}
            onChangeText={(value) => change({ residual: value }, 'residual')}
            prefix="R$"
            placeholder="0,00"
            numeric
            hint="opcional"
            error={errorOf('residual')}
          />
        </View>
      </Row>
      <Text style={s.hint}>
        O valor de revenda é quanto você acha que conseguiria por ele no fim da vida útil. Deixe em
        branco se pretende usar até o fim.
      </Text>
      <Row>
        <View style={ui.grow}>
          <Field
            label="Vida útil (meses)"
            value={form.life}
            onChangeText={(value) => change({ life: value }, 'life')}
            numeric
            error={errorOf('life')}
          />
        </View>
        <View style={ui.grow}>
          <Field
            label="Data da compra"
            value={form.date}
            onChangeText={(value) => change({ date: value }, 'date')}
            placeholder="DD/MM/AAAA"
            error={errorOf('date')}
          />
        </View>
      </Row>
      {/* Aviso da seção 11: vida útil curta demais infla a reserva, e a reserva
          agora aparece no preço de todo serviço. */}
      {life > 0 && life < SHORT_LIFE_MONTHS && !errorOf('life') && <Notice
        tone="warning"
        message={`Menos de ${SHORT_LIFE_MONTHS} meses de uso deixa a reserva mensal bem alta. Confira se é esse o tempo que você espera usar.`}
      />}
    </FormSheet>
  </Screen>;
}

const s = StyleSheet.create({
  hint: { color: colors.faded, fontSize: 11, lineHeight: 17 },
  rowNote: { color: colors.warning, fontSize: 11, lineHeight: 17, marginTop: 5 },
});
