import { colors } from '../theme';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { EQUIPMENT_TYPES, labelOf, slugOf } from '../lib/catalog';
import {
  createEquipment,
  deleteEquipment,
  listEquipment,
  updateEquipment,
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
  Button,
  ChoiceField,
  EmptyState,
  Field,
  FormSheet,
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
 * Equipamentos do documento 07 — cadastro, e só cadastro.
 *
 * O documento coloca o recurso **fora do MVP**, e a tela respeita isso ao pé da
 * letra: ela guarda o que a profissional comprou e não calcula nada com esses
 * números. Nenhuma depreciação é inventada aqui, e a reserva mensal para
 * reposição continua fora do rateio de custo fixo — a interface diz isso em voz
 * alta, porque uma tela que pergunta preço e vida útil sem avisar sugere que o
 * preço do serviço já está cobrindo a troca do aparelho. Não está.
 *
 * Os dados não passam pelo `AppProvider`: nenhum cálculo depende deles, e uma
 * requisição a cada abertura do aplicativo por causa de um recurso fora do MVP
 * seria caro para quem nunca entrar aqui.
 */

type Props = { onBack?: () => void };

const emptyForm = { name: '', type: EQUIPMENT_TYPES[0].label, price: '', residual: '', life: '24', date: '' };

export function EquipmentScreen({ onBack }: Props) {
  const app = useApp();
  const { busy, error, setError, clear, run } = useSubmit();
  const [list, setList] = useState<Equipment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [done, setDone] = useState<string | null>(null);

  const token = app.token;
  const business = app.business;

  const load = useCallback(async () => {
    if (!token || !business) return;
    setLoadError(null);
    try {
      setList(await listEquipment({ token, businessId: business.id }));
    } catch (failure) {
      setLoadError(message(failure));
    }
  }, [token, business]);

  useEffect(() => {
    void load();
  }, [load]);

  const startNew = () => {
    setEditing(null);
    setForm(emptyForm);
    clear();
    setDone(null);
    setOpen(true);
  };

  const startEdit = (item: Equipment) => {
    setEditing(item);
    setForm({
      name: item.name,
      type: labelOf(EQUIPMENT_TYPES, item.type),
      price: centsToInput(item.acquisitionPriceCents),
      residual: item.residualValueCents > 0 ? centsToInput(item.residualValueCents) : '',
      life: String(item.usefulLifeMonths),
      date: formatIsoDate(item.acquisitionDate),
    });
    clear();
    setDone(null);
    setOpen(true);
  };

  const submit = () => {
    const life = Math.round(parseNumber(form.life));
    const acquisitionDate = parseIsoDate(form.date);

    if (!form.name.trim()) {
      setError('Dê um nome ao equipamento.');
      return;
    }
    if (life <= 0) {
      setError('A vida útil precisa ser de pelo menos um mês.');
      return;
    }
    if (!acquisitionDate) {
      setError('Escreva a data da compra no formato DD/MM/AAAA.');
      return;
    }
    if (parseCents(form.residual) > parseCents(form.price)) {
      setError('O valor residual não pode ser maior do que o preço pago.');
      return;
    }

    const input = {
      name: form.name.trim(),
      type: slugOf(EQUIPMENT_TYPES, form.type),
      acquisitionPriceCents: parseCents(form.price),
      residualValueCents: parseCents(form.residual),
      usefulLifeMonths: life,
      acquisitionDate,
    };

    void run(async () => {
      if (!token || !business) return;
      const scope = { token, businessId: business.id };
      const saved = editing
        ? await updateEquipment(scope, editing.id, input)
        : await createEquipment(scope, input);

      setList((current) => (editing
        ? (current ?? []).map((item) => (item.id === saved.id ? saved : item))
        : [...(current ?? []), saved]));
      setOpen(false);
      setDone(editing ? 'Equipamento atualizado.' : 'Equipamento cadastrado.');
    });
  };

  const remove = () => {
    const item = editing;
    if (!item || !token || !business) return;

    void run(async () => {
      await deleteEquipment({ token, businessId: business.id }, item.id);
      setList((current) => (current ?? []).filter((other) => other.id !== item.id));
      setOpen(false);
      setDone(`"${item.name}" saiu da sua lista.`);
    });
  };

  const active = (list ?? []).filter((item) => !item.isArchived);
  const invested = active.reduce((sum, item) => sum + item.acquisitionPriceCents, 0);

  return <Screen>
    <ScreenHeader title="Equipamentos" subtitle="O que você comprou para trabalhar" onBack={onBack} />

    {/*
      O aviso vem antes da lista, e não no rodapé: quem cadastra preço e vida
      útil espera que isso vire conta em algum lugar, e precisa saber que ainda
      não vira antes de digitar.
    */}
    <Notice
      tone="lilac"
      message="Por enquanto isto é só um cadastro: a reserva mensal para repor o equipamento ainda não entra no rateio do seu custo fixo, e o preço dos seus serviços não muda por causa dela."
    />

    {list !== null && <Row>
      <StatCard icon="settings" label="Equipamentos" value={String(active.length)} caption="Na sua lista" />
      <StatCard icon="wallet" label="Investido" value={formatCents(invested)} caption="Soma das compras" tone="lilac" />
    </Row>}

    {done && <Notice tone="success" message={done} />}
    {!open && error && <Notice message={error} />}

    <Button label="Adicionar equipamento" icon="plus" onPress={startNew} />

    <Section title="Meus equipamentos" first />
    {loadError && <Notice message={loadError} action="Tentar de novo" onAction={() => void load()} />}
    {list === null && !loadError && <Loading label="Buscando os seus equipamentos..." />}
    {list !== null && active.length === 0 && (
      <EmptyState
        icon="settings"
        title="Nenhum equipamento cadastrado"
        description="Cabine, maca, lixadeira, autoclave: registre o que você comprou para saber quanto o seu negócio já tem investido."
        action="Adicionar equipamento"
        onAction={startNew}
      />
    )}
    {active.map((item) => (
      <ListRow
        key={item.id}
        icon="settings"
        title={item.name}
        subtitle={`${labelOf(EQUIPMENT_TYPES, item.type)} · comprado em ${formatIsoDate(item.acquisitionDate)} · vida útil de ${item.usefulLifeMonths} ${item.usefulLifeMonths === 1 ? 'mês' : 'meses'}`}
        meta={formatCents(item.acquisitionPriceCents)}
        onPress={() => startEdit(item)}
      />
    ))}

    <FormSheet
      visible={open}
      title={editing ? 'Editar equipamento' : 'Novo equipamento'}
      subtitle="Nenhum destes números entra no preço dos seus serviços hoje."
      busy={busy}
      error={error}
      onClose={() => setOpen(false)}
      onSubmit={submit}
      onDelete={editing ? remove : undefined}
      deleteQuestion={editing ? `Excluir "${editing.name}" da sua lista de equipamentos?` : undefined}
    >
      <Field
        label="Nome do equipamento"
        value={form.name}
        onChangeText={(value) => setForm({ ...form, name: value })}
        placeholder="Ex.: Cabine da bancada"
      />
      <ChoiceField
        label="Tipo"
        items={EQUIPMENT_TYPES.map((item) => item.label)}
        value={form.type}
        onChange={(value) => setForm({ ...form, type: value })}
      />
      <Row>
        <View style={ui.grow}>
          <Field
            label="Preço que você pagou"
            value={form.price}
            onChangeText={(value) => setForm({ ...form, price: value })}
            prefix="R$"
            placeholder="0,00"
            numeric
          />
        </View>
        <View style={ui.grow}>
          <Field
            label="Valor residual"
            value={form.residual}
            onChangeText={(value) => setForm({ ...form, residual: value })}
            prefix="R$"
            placeholder="0,00"
            numeric
            hint="opcional"
          />
        </View>
      </Row>
      <Text style={s.hint}>
        O valor residual é quanto você acha que ele ainda valeria ao fim da vida útil, se fosse vendido.
      </Text>
      <Row>
        <View style={ui.grow}>
          <Field
            label="Vida útil (meses)"
            value={form.life}
            onChangeText={(value) => setForm({ ...form, life: value })}
            numeric
          />
        </View>
        <View style={ui.grow}>
          <Field
            label="Data da compra"
            value={form.date}
            onChangeText={(value) => setForm({ ...form, date: value })}
            placeholder="DD/MM/AAAA"
          />
        </View>
      </Row>
    </FormSheet>
  </Screen>;
}

const s = StyleSheet.create({
  hint: { color: colors.faded, fontSize: 11, lineHeight: 17 },
});
