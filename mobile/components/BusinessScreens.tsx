import { colors } from '../theme';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { track } from '../lib/analytics';
import { FIXED_COST_CATEGORIES, labelOf, slugOf } from '../lib/catalog';
import { getPlans, startCheckout, type AllocationMethod, type Calculation, type FixedCostBreakdown, type PlanCatalog, type PlanOffer, type PricingResult, type RoundingStrategy, type Service, type Subscription, type SubscriptionChannel } from '../lib/resources';
import { centsToInput, formatCents, formatMoney, formatPercent, parseCents, parseNumber, useSubmit } from '../lib/useSubmit';
import { useApp } from '../state/AppProvider';
import { useDialog } from './Dialog';
import { Icon } from './AppChrome';
import { Badge, Button, Card, ChoiceField, DetailSheet, EmptyState, Field, FormSheet, HeroCard, ListRow, Loading, Notice, PlanLimitNotice, Row, Screen, ScreenHeader, Section, StatCard, SwitchRow, ui } from './ui';
import { GoalSimulator } from './GoalSimulator';
import { PriceChooser } from './PriceChooser';
import { PublicCalculator } from './PublicCalculator';
import { ServiceSheet } from './ServiceSheet';

type ScreenProps = { onBack?: () => void; onUpgrade?: () => void };

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <View style={s.line}><Text style={[s.lineLabel, strong && s.lineStrong]}>{label}</Text><Text style={[s.lineValue, strong && s.lineStrong]}>{value}</Text></View>;
}

// --- serviços -------------------------------------------------------------

export function ServicesScreen({ onBack, onUpgrade }: ScreenProps) {
  const app = useApp();
  const [editing, setEditing] = useState<Service | null>(null);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const limit = app.subscription?.limits.services ?? null;
  // O limite do plano conta o cadastro inteiro, arquivados inclusive, que é
  // como o servidor conta ao recusar mais um.
  const reachedLimit = limit !== null && app.services.length >= limit;

  const openSheet = (service: Service | null) => {
    setEditing(service);
    setDone(null);
    setOpen(true);
  };

  const materialCostOf = (service: Service) =>
    service.materials.reduce((sum, item) => {
      const material = app.materials.find(entry => entry.id === item.materialId);
      return sum + Math.round((material?.unitCostCents ?? 0) * item.quantityUsed);
    }, 0);

  const active = app.services.filter(service => !service.isArchived);
  const archived = app.services.filter(service => service.isArchived);
  const priced = active.filter(service => service.currentPriceCents !== null);
  const average = priced.length
    ? priced.reduce((sum, item) => sum + (item.currentPriceCents ?? 0), 0) / priced.length
    : 0;

  const rowOf = (service: Service) => (
    <ListRow
      key={service.id}
      icon="sparkle"
      iconTone={service.isArchived ? 'neutral' : 'pink'}
      title={service.name}
      subtitle={`${service.durationMinutes} min · ${service.materials.length ? `${service.materials.length} ${service.materials.length === 1 ? 'material' : 'materiais'} (${formatCents(materialCostOf(service))})` : 'sem materiais'}`}
      meta={service.currentPriceCents === null ? 'definir preço' : formatCents(service.currentPriceCents)}
      badge={service.isArchived ? <Badge label="Arquivado" tone="warning" /> : undefined}
      onPress={() => openSheet(service)}
    />
  );

  return <Screen>
    <ScreenHeader title="Serviços" subtitle="O que você faz, e quanto custa para fazer" onBack={onBack} />
    <Row>
      <StatCard icon="tag" label="Serviços salvos" value={limit === null ? String(app.services.length) : `${app.services.length} de ${limit}`} caption={limit === null ? 'Ilimitados no seu plano' : 'Limite do plano gratuito'} />
      <StatCard icon="wallet" label="Preço médio" value={formatCents(average)} caption={priced.length ? 'Entre os preços definidos' : 'Nenhum preço definido'} tone="lilac" />
    </Row>
    {done && <Notice tone="success" message={done} />}
    {reachedLimit && <PlanLimitNotice message="Você já usa todos os serviços do plano gratuito. Nada é apagado: ao assinar, o cadastro fica sem limite." onUpgrade={onUpgrade} />}
    <Button label="Adicionar serviço" icon="plus" onPress={() => openSheet(null)} />
    <Section title="Minha tabela" first />
    {active.length === 0
      ? <EmptyState
        icon="tag"
        title={archived.length > 0 ? 'Nenhum serviço ativo' : 'Nenhum serviço ainda'}
        description={archived.length > 0
          ? 'Todos os seus serviços estão arquivados. Restaure um deles ou cadastre outro.'
          : 'Cadastre o primeiro com os materiais que você usa: o preço sai dos seus números, não de um chute.'}
        action="Adicionar serviço"
        onAction={() => openSheet(null)}
      />
      : active.map(rowOf)}
    <Text style={s.hint}>O preço aparece aqui depois que você calcula e escolhe quanto vai cobrar.</Text>

    {archived.length > 0 && <>
      <Section title="Arquivados" />
      <Text style={s.hint}>Ficam fora da tabela e da calculadora, mas os cálculos que eles já explicaram continuam no histórico.</Text>
      {archived.map(rowOf)}
    </>}

    <ServiceSheet
      visible={open}
      service={editing}
      onClose={() => setOpen(false)}
      onSaved={saved => setDone(`"${saved.name}" está salvo na sua tabela.`)}
      onArchived={(saved, isArchived) => setDone(isArchived
        ? `"${saved.name}" foi arquivado e saiu da sua tabela.`
        : `"${saved.name}" voltou para a sua tabela.`)}
      onUpgrade={onUpgrade}
    />
  </Screen>;
}

// --- custos ---------------------------------------------------------------

const emptyCost = { name: '', category: FIXED_COST_CATEGORIES[0].label, amount: '', active: true };

/** As duas formas de rateio que o servidor aceita, com o nome que a usuária lê. */
const ALLOCATIONS: { label: string; slug: AllocationMethod }[] = [
  { label: 'Por hora de atendimento', slug: 'PRODUCTIVE_HOUR' },
  { label: 'Por atendimento', slug: 'APPOINTMENT' },
];

const ROUNDINGS: { label: string; slug: RoundingStrategy }[] = [
  { label: 'Sem arredondar', slug: 'NONE' },
  { label: 'Múltiplo de R$ 1', slug: 'NEAREST_1' },
  { label: 'Múltiplo de R$ 5', slug: 'NEAREST_5' },
  { label: 'Múltiplo de R$ 10', slug: 'NEAREST_10' },
  { label: 'Terminar em 90', slug: 'ENDING_90' },
];

export function CostsScreen({ onBack, onUpgrade }: ScreenProps) {
  const app = useApp();
  const cost = useSubmit();
  const hour = useSubmit();
  const [open, setOpen] = useState(false);
  const [hourOpen, setHourOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyCost);
  const [done, setDone] = useState<string | null>(null);
  const [config, setConfig] = useState({
    withdrawal: '',
    hours: '',
    appointments: '',
    allocation: ALLOCATIONS[0].label,
    rounding: ROUNDINGS[0].label,
  });

  const total = app.fixedCosts.reduce((sum, item) => sum + (item.isActive ? item.monthlyAmountCents : 0), 0);
  const settings = app.settings;
  const limit = app.subscription?.limits.fixedCosts ?? null;
  const reachedLimit = limit !== null && app.fixedCosts.length >= limit;

  const startNew = (preset?: Partial<typeof emptyCost>) => {
    setEditingId(null);
    setForm({ ...emptyCost, ...preset });
    cost.clear();
    setDone(null);
    setOpen(true);
  };

  const startEdit = (id: string) => {
    const item = app.fixedCosts.find(entry => entry.id === id);
    if (!item) return;
    setEditingId(id);
    setForm({ name: item.name, category: labelOf(FIXED_COST_CATEGORIES, item.category), amount: centsToInput(item.monthlyAmountCents), active: item.isActive });
    cost.clear();
    setDone(null);
    setOpen(true);
  };

  const submit = () => {
    const input = {
      name: form.name.trim(),
      category: slugOf(FIXED_COST_CATEGORIES, form.category),
      monthlyAmountCents: parseCents(form.amount),
      isActive: form.active,
    };
    if (!input.name) {
      cost.setError('Dê um nome à despesa.');
      return;
    }

    void cost.run(async () => {
      if (editingId) await app.updateFixedCost(editingId, input);
      else await app.createFixedCost(input);
      setOpen(false);
      setDone(editingId ? 'Despesa atualizada.' : 'Despesa cadastrada.');
    });
  };

  const remove = () => {
    if (!editingId) return;
    void cost.run(async () => {
      await app.removeFixedCost(editingId);
      setOpen(false);
      setDone('Despesa excluída.');
    });
  };

  const openHour = () => {
    if (!settings) return;
    setConfig({
      withdrawal: centsToInput(settings.desiredMonthlyWithdrawalCents),
      hours: String(settings.productiveHoursPerMonth),
      appointments: String(settings.estimatedAppointmentsPerMonth),
      allocation: ALLOCATIONS.find(item => item.slug === settings.fixedCostAllocationMethod)?.label ?? ALLOCATIONS[0].label,
      rounding: ROUNDINGS.find(item => item.slug === settings.roundingStrategy)?.label ?? ROUNDINGS[0].label,
    });
    hour.clear();
    setDone(null);
    setHourOpen(true);
  };

  const saveHour = () => {
    const productiveHoursPerMonth = parseNumber(config.hours);
    const estimatedAppointmentsPerMonth = Math.round(parseNumber(config.appointments));
    if (productiveHoursPerMonth <= 0) {
      hour.setError('As horas de atendimento precisam ser maiores que zero.');
      return;
    }
    if (estimatedAppointmentsPerMonth <= 0) {
      hour.setError('Informe quantos atendimentos você faz por mês, mais ou menos.');
      return;
    }

    void hour.run(async () => {
      await app.saveSettings({
        desiredMonthlyWithdrawalCents: parseCents(config.withdrawal),
        productiveHoursPerMonth,
        estimatedAppointmentsPerMonth,
        fixedCostAllocationMethod: ALLOCATIONS.find(item => item.label === config.allocation)?.slug ?? 'PRODUCTIVE_HOUR',
        roundingStrategy: ROUNDINGS.find(item => item.label === config.rounding)?.slug ?? 'NONE',
      });
      setHourOpen(false);
      setDone('Configuração salva.');
    });
  };

  const previewHour = parseNumber(config.hours) > 0 ? parseCents(config.withdrawal) / parseNumber(config.hours) : 0;

  return <Screen>
    <ScreenHeader title="Custos" subtitle="Entenda para onde vai o seu dinheiro" onBack={onBack} />
    <HeroCard
      label="Custos fixos por mês"
      value={formatCents(total)}
      caption={`${app.fixedCosts.length} ${app.fixedCosts.length === 1 ? 'despesa cadastrada' : 'despesas cadastradas'}`}
      hint="Rateados pelas suas horas produtivas"
    />
    <Row>
      <StatCard icon="box" label="Materiais" value={`${app.materials.length} ${app.materials.length === 1 ? 'item' : 'itens'}`} caption="Cadastrados no estoque" />
      <StatCard
        icon="clock"
        label="Hora produtiva"
        value={settings?.hourlyRateCents ? formatCents(settings.hourlyRateCents) : '—'}
        caption={settings ? `${settings.productiveHoursPerMonth} h por mês` : 'A configurar'}
        tone="lilac"
        onPress={openHour}
        accessibilityLabel="Editar a sua hora de trabalho"
      />
    </Row>
    {done && <Notice tone="success" message={done} />}
    {!open && cost.error && (cost.limitReached
      ? <PlanLimitNotice message={cost.error} onUpgrade={onUpgrade} />
      : <Notice message={cost.error} />)}
    {reachedLimit && <PlanLimitNotice message="Você já usa todos os custos fixos do plano gratuito. Nada é apagado: ao assinar, o cadastro fica sem limite." onUpgrade={onUpgrade} />}
    <Button label="Adicionar despesa" icon="plus" onPress={() => startNew()} />
    <Button label="Sua hora de trabalho e o rateio" icon="clock" secondary onPress={openHour} />

    <Section title="Suas despesas fixas" first />
    {cost.busy && !open && <Loading label="Atualizando seus custos..." />}
    {app.fixedCosts.length === 0
      ? <EmptyState
        icon="wallet"
        title="Nenhuma despesa cadastrada"
        description="Aluguel, energia, internet: o que sai todo mês, independentemente de atender. Se preferir, informe só o total."
        action="Informar só o total do mês"
        onAction={() => startNew({ name: 'Total de custos fixos', category: labelOf(FIXED_COST_CATEGORIES, 'other') })}
      />
      : app.fixedCosts.map(item => (
        <ListRow
          key={item.id}
          icon="wallet"
          title={item.name}
          subtitle={labelOf(FIXED_COST_CATEGORIES, item.category)}
          meta={formatCents(item.monthlyAmountCents)}
          badge={item.isActive ? undefined : <Badge label="Fora da conta do mês" tone="warning" />}
          onPress={() => startEdit(item.id)}
        />
      ))}

    <FormSheet
      visible={open}
      title={editingId ? 'Editar despesa' : 'Nova despesa fixa'}
      busy={cost.busy}
      error={cost.error}
      limitReached={cost.limitReached}
      onUpgrade={onUpgrade}
      onClose={() => setOpen(false)}
      onSubmit={submit}
      onDelete={editingId ? remove : undefined}
    >
      <Field label="Nome da despesa" value={form.name} onChangeText={value => setForm({ ...form, name: value })} placeholder="Ex.: Aluguel do espaço" />
      <ChoiceField label="Categoria" items={FIXED_COST_CATEGORIES.map(item => item.label)} value={form.category} onChange={value => setForm({ ...form, category: value })} />
      <Field label="Valor por mês" value={form.amount} onChangeText={value => setForm({ ...form, amount: value })} prefix="R$" numeric />
      <SwitchRow
        label="Entra na conta deste mês"
        description="Desligue para guardar a despesa sem somá-la no rateio."
        value={form.active}
        onValueChange={value => setForm({ ...form, active: value })}
      />
    </FormSheet>

    <FormSheet
      visible={hourOpen}
      title="Sua hora de trabalho"
      subtitle="O valor da hora sai da retirada dividida pelas horas de atendimento."
      busy={hour.busy}
      error={hour.error}
      onClose={() => setHourOpen(false)}
      onSubmit={saveHour}
    >
      <Field label="Quanto quer retirar por mês" value={config.withdrawal} onChangeText={value => setConfig({ ...config, withdrawal: value })} prefix="R$" numeric />
      <Field label="Horas que você atende por mês" value={config.hours} onChangeText={value => setConfig({ ...config, hours: value })} numeric hint={`${formatCents(previewHour)} / hora`} />
      <Text style={s.hint}>Horas disponíveis não são horas faturáveis: compras, limpeza e redes sociais ficam de fora desta conta.</Text>
      <Field label="Atendimentos por mês, mais ou menos" value={config.appointments} onChangeText={value => setConfig({ ...config, appointments: value })} numeric />
      <ChoiceField label="Como ratear os custos fixos" items={ALLOCATIONS.map(item => item.label)} value={config.allocation} onChange={value => setConfig({ ...config, allocation: value })} />
      <ChoiceField label="Arredondamento do preço" items={ROUNDINGS.map(item => item.label)} value={config.rounding} onChange={value => setConfig({ ...config, rounding: value })} />
    </FormSheet>
  </Screen>;
}

// --- calculadora ----------------------------------------------------------

/**
 * A calculadora, que é o motivo de o aplicativo existir.
 *
 * O caminho é o mesmo do papel: escolher o serviço, conferir o que entra nele,
 * calcular e decidir quanto cobrar. Quem ainda não cadastrou nada faz um
 * cálculo rápido com os números na mão e cadastra depois.
 */
export function PricingScreen({ onBack, onUpgrade, onEquipment }: ScreenProps & { onEquipment?: () => void }) {
  const app = useApp();
  const { busy, error, setError, run } = useSubmit();
  const expense = useSubmit();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ name: '', category: FIXED_COST_CATEGORIES[0].label, amount: '' });
  // Serviço arquivado sai da calculadora: ele não faz mais parte da tabela.
  const selectable = app.services.filter(item => !item.isArchived);
  const [mode, setMode] = useState<string>(selectable.length ? 'Meus serviços' : 'Cálculo rápido');
  const [selected, setSelected] = useState<string | null>(selectable[0]?.id ?? null);
  const [result, setResult] = useState<PricingResult | null>(null);
  /**
   * De onde veio o custo fixo do último cálculo.
   *
   * Só o servidor sabe: a reserva dos equipamentos entra no custo fixo lá, e a
   * tela não carrega a lista de equipamentos. Guardá-la é o que permite
   * responder à pergunta da seção 11 do documento 07 — por que o preço subiu.
   */
  const [breakdown, setBreakdown] = useState<FixedCostBreakdown | null>(null);
  const [savedPrice, setSavedPrice] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detail, setDetail] = useState<Calculation | null>(null);

  const nameOf = (calculation: Calculation) =>
    app.services.find(entry => entry.id === calculation.serviceId)?.name ?? 'Cálculo avulso';

  const service = selectable.find(item => item.id === selected) ?? null;
  const settings = app.settings;
  const fixedTotal = app.fixedCosts.reduce((sum, item) => sum + (item.isActive ? item.monthlyAmountCents : 0), 0);
  const usingService = service !== null;

  const materialCost = service
    ? service.materials.reduce((sum, item) => {
      const material = app.materials.find(entry => entry.id === item.materialId);
      return sum + Math.round((material?.unitCostCents ?? 0) * item.quantityUsed);
    }, 0)
    : 0;

  /**
   * O custo fixo do mês, separado como o servidor o somou.
   *
   * Antes do primeiro cálculo só existe a soma local das despesas; depois vale
   * a do servidor, que é a que virou preço. A reserva dos equipamentos só
   * aparece depois de calcular porque é ele quem a conhece.
   */
  const expensesTotal = breakdown?.expensesCents ?? fixedTotal;
  const equipmentReserve = breakdown?.equipmentReserveCents ?? 0;
  const monthlyFixedTotal = expensesTotal + equipmentReserve;

  /**
   * Quanto da parcela rateada neste atendimento é reserva de equipamento.
   *
   * O rateio é proporcional ao custo fixo do mês, então a parcela guarda a
   * mesma proporção. É a resposta da seção 11 do documento 07 em números que a
   * usuária pode conferir: sem ela, o custo fixo rateado simplesmente cresce.
   */
  const reserveShareCents = result && equipmentReserve > 0 && monthlyFixedTotal > 0
    ? Math.round(result.allocatedFixedCost * 100 * equipmentReserve / monthlyFixedTotal)
    : 0;

  const calculate = () => {
    if (!service) return;
    setSavedPrice(null);
    track('calculation_started', { origem: 'servico' });
    void run(async () => {
      const priced = await app.priceService(service.id, {});
      setResult(priced.result);
      setBreakdown(priced.fixedCostBreakdown);
      track('calculation_completed', { origem: 'servico' });
    });
  };

  /** O preço escolhido vira o preço do serviço e entra no histórico junto. */
  const usePrice = (price: number) => {
    if (!service) return;
    void run(async () => {
      const cents = Math.round(price * 100);
      await app.updateService(service.id, { currentPriceCents: cents });
      await app.priceService(service.id, { save: true, currentPriceCents: cents });
      setSavedPrice(price);
    });
  };

  // Sem serviço cadastrado, ou quando a usuária pede um cálculo avulso, quem
  // atende é a mesma calculadora da jornada pública — já com os seus números.
  if (mode === 'Cálculo rápido') {
    return <PublicCalculator
      onBack={app.services.length ? () => { setMode('Meus serviços'); setError(null); } : onBack}
      prefill={{
        hourlyRate: settings?.hourlyRateCents ? settings.hourlyRateCents / 100 : undefined,
        monthlyFixedCosts: fixedTotal / 100,
        monthlyProductiveHours: settings?.productiveHoursPerMonth,
        desiredMonthlyWithdrawal: settings ? settings.desiredMonthlyWithdrawalCents / 100 : undefined,
        monthlyAppointments: settings?.estimatedAppointmentsPerMonth,
        monthlyProfitGoalCents: settings?.monthlyProfitGoalCents,
      }}
      onSave={async input => { await app.saveQuickCalculation(input); }}
    />;
  }

  /** Custo fixo cadastrado aqui entra no rateio do próximo cálculo. */
  const saveExpense = () => {
    if (!expenseForm.name.trim()) {
      expense.setError('Dê um nome à despesa.');
      return;
    }

    void expense.run(async () => {
      await app.createFixedCost({
        name: expenseForm.name.trim(),
        category: slugOf(FIXED_COST_CATEGORIES, expenseForm.category),
        monthlyAmountCents: parseCents(expenseForm.amount),
      });
      setExpenseForm({ name: '', category: FIXED_COST_CATEGORIES[0].label, amount: '' });
      setExpenseOpen(false);
      setResult(null);
      setBreakdown(null);
    });
  };

  return <Screen>
    <ScreenHeader title="Calcular preço" subtitle="Descubra quanto cobrar sem trabalhar no prejuízo" onBack={onBack} />

    <Section title="1. Qual serviço" first />
    <ChoiceField
      label="Serviço a calcular"
      items={selectable.map(item => item.name)}
      value={service?.name ?? ''}
      onChange={name => {
        setSelected(selectable.find(item => item.name === name)?.id ?? null);
        setResult(null);
        setBreakdown(null);
        setSavedPrice(null);
      }}
    />
    {service && <>
        <Section title="2. O que entra nele" />
        <Card onPress={() => setSheetOpen(true)} accessibilityLabel="Editar serviço e materiais">
          <Line label="Duração" value={`${service.durationMinutes} minutos`} />
          <Line label="Materiais" value={service.materials.length ? `${service.materials.length} · ${formatCents(materialCost)}` : 'nenhum cadastrado'} />
          {service.otherDirectCostCents > 0 && <Line label="Outros custos diretos" value={formatCents(service.otherDirectCostCents)} />}
          <Line label="Margem desejada" value={formatPercent(service.desiredMarginPercent)} />
          {service.salesFeePercent > 0 && <Line label="Taxa de venda" value={formatPercent(service.salesFeePercent)} />}
          <Text style={s.editHint}>Toque para editar o serviço e a lista de materiais.</Text>
        </Card>
        {service.materials.length === 0 && <Notice tone="lilac" message="Sem materiais na composição, o cálculo considera só o seu tempo e os custos fixos." action="Adicionar" onAction={() => setSheetOpen(true)} />}
      </>}

    <Section title="3. Seus custos fixos" />
    <Card onPress={app.fixedCosts.length ? () => setExpenseOpen(true) : undefined} accessibilityLabel="Adicionar despesa fixa">
      <Line label="Despesas do mês" value={formatCents(expensesTotal)} />
      {/*
        A reserva aparece como linha do custo fixo, e não como termo novo: é
        exatamente onde ela entra na conta, segundo a seção 6 do documento 07.
        Sem esta linha, o total daqui não bateria com o do cálculo e a diferença
        ficaria sem explicação.
      */}
      {equipmentReserve > 0 && <Line label="Reserva para repor equipamentos" value={formatCents(equipmentReserve)} />}
      <Line label="Total por mês" value={formatCents(monthlyFixedTotal)} strong />
      <Line label="Despesas cadastradas" value={String(app.fixedCosts.length)} />
      <Text style={s.editHint}>
        {app.fixedCosts.length
          ? 'Aluguel, energia, internet: rateados por hora produtiva em cada atendimento.'
          : 'Sem despesas cadastradas, o preço cobre só materiais e o seu tempo.'}
      </Text>
    </Card>
    {app.fixedCosts.length === 0
      ? <Notice tone="lilac" message="Cadastre o que sai todo mês, mesmo quando você não atende: é isso que o preço precisa cobrir." action="Adicionar despesa" onAction={() => setExpenseOpen(true)} />
      : <Button label="Adicionar despesa fixa" icon="plus" secondary onPress={() => setExpenseOpen(true)} />}

    <Button label={busy ? 'Calculando...' : '4. Calcular meu preço'} icon="arrow" onPress={busy || !service ? undefined : calculate} />
    <Button label="Fazer um cálculo avulso" icon="calculator" secondary onPress={() => { setMode('Cálculo rápido'); setResult(null); setBreakdown(null); setSavedPrice(null); setError(null); }} />

    {error && <Notice message={error} />}

    {result && <View accessibilityLiveRegion="polite">
      <Section title="Seu custo por atendimento" />
      <Card>
        <Line label="Materiais" value={formatMoney(result.materialCost)} />
        <Line label="Mão de obra" value={formatMoney(result.laborCost)} />
        <Line label="Custos fixos rateados" value={formatMoney(result.allocatedFixedCost)} />
        {reserveShareCents > 0 && <Text style={s.subLine}>Deste rateio, {formatCents(reserveShareCents)} é reserva para repor equipamentos.</Text>}
        {result.otherDirectCosts > 0 && <Line label="Outros custos diretos" value={formatMoney(result.otherDirectCosts)} />}
        <Line label="Custo total" value={formatMoney(result.totalCost)} strong />
        <Text style={s.method}>Rateio por {result.allocationMethod === 'productive_hour' ? 'hora produtiva' : 'atendimento'} · sua hora a {formatMoney(result.hourlyRate)}</Text>
      </Card>

      {/*
        Vem antes do preço, e não depois: a seção 11 do documento 07 avisa que o
        risco da reserva é a sensação de preço inflado, e a hora de explicar de
        onde vem o aumento é antes de a usuária ver o número.
      */}
      {equipmentReserve > 0 && <Notice
        tone="lilac"
        message={`Dos ${formatCents(monthlyFixedTotal)} de custo fixo por mês, ${formatCents(equipmentReserve)} são a reserva para repor os seus equipamentos: um pouco guardado por mês para trocar o aparelho quando ele acabar. Por isso este preço é maior do que seria sem eles.`}
        action={onEquipment ? 'Ver equipamentos' : undefined}
        onAction={onEquipment}
      />}

      <PriceChooser
        result={result}
        feePercent={service ? service.salesFeePercent : 0}
        currentPrice={usingService && service?.currentPriceCents ? service.currentPriceCents / 100 : null}
        busy={busy}
        onUse={usingService ? usePrice : undefined}
        label="Usar este preço no serviço"
      />

      {result.currentProfit !== undefined && <>
        <Section title="Comparado ao que você cobra hoje" />
        {result.currentProfit <= 0
          ? <Notice message="O preço que você cobra hoje não cobre o seu custo: cada atendimento sai do seu bolso." />
          : result.currentMarginPercent !== undefined && result.currentMarginPercent < result.expectedMarginPercent
            ? <Notice tone="warning" message="O preço de hoje dá lucro, mas abaixo da margem que você pediu." />
            : null}
        <Card>
          <Line label="Lucro no preço de hoje" value={formatMoney(result.currentProfit)} />
          {result.currentMarginPercent !== undefined && <Line label="Margem de hoje" value={formatPercent(result.currentMarginPercent)} />}
          <Line label="Diferença para o recomendado" value={formatMoney(result.expectedProfit - result.currentProfit)} strong />
        </Card>
      </>}

      <Text style={s.hint}>Estimativa calculada com os dados que você informou.</Text>
      {savedPrice !== null && <Notice tone="success" message={`Pronto: ${service?.name ?? 'o serviço'} agora vale ${formatMoney(savedPrice)}, e o cálculo entrou no seu histórico.`} />}

      {/* Depois do preço vem a pergunta seguinte: isso dá para viver? (item A-04) */}
      <GoalSimulator
        totalCost={result.totalCost}
        feePercent={service ? service.salesFeePercent : 0}
        currentPrice={service?.currentPriceCents ? service.currentPriceCents / 100 : null}
        monthlyAppointments={settings?.estimatedAppointmentsPerMonth ?? null}
        initialGoalCents={settings?.monthlyProfitGoalCents ?? null}
      />
    </View>}

    <Section title="Histórico" />
    {app.calculations.length === 0
      ? <EmptyState icon="clock" title="Nenhum cálculo salvo" description="Escolha um preço para um serviço e o cálculo entra aqui." />
      : app.calculations.map(item => (
        <ListRow
          key={item.id}
          icon="clock"
          title={nameOf(item)}
          subtitle={new Date(item.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
          meta={formatCents(item.commercialPriceCents)}
          onPress={() => { setDetail(item); track('result_explained_opened', { origem: 'historico' }); }}
        />
      ))}
    {app.calculationsLimitedByPlan && <Notice tone="warning" message="Seu plano mostra os cálculos mais recentes. Os anteriores continuam guardados e voltam a aparecer ao assinar." action="Ver planos" onAction={onUpgrade} />}
    <Text style={s.hint}>O histórico guarda a fotografia dos dados usados: editar um material depois não muda um cálculo antigo.</Text>

    <DetailSheet
      visible={detail !== null}
      title={detail ? nameOf(detail) : ''}
      subtitle={detail ? new Date(detail.createdAt).toLocaleString('pt-BR') : undefined}
      onClose={() => setDetail(null)}
    >
      {detail && <>
        <Card>
          <Line label="Materiais" value={formatCents(detail.materialCostCents)} />
          <Line label="Mão de obra" value={formatCents(detail.laborCostCents)} />
          <Line label="Custos fixos rateados" value={formatCents(detail.allocatedFixedCostCents)} />
          {detail.otherDirectCostCents > 0 && <Line label="Outros custos diretos" value={formatCents(detail.otherDirectCostCents)} />}
          <Line label="Custo total" value={formatCents(detail.totalBaseCostCents)} strong />
        </Card>
        <Card>
          <Line label="Preço mínimo" value={formatCents(detail.minimumPriceCents)} />
          <Line label="Preço calculado" value={formatCents(detail.suggestedPriceCents)} />
          <Line label="Preço escolhido" value={formatCents(detail.commercialPriceCents)} strong />
          <Line label="Lucro" value={`${formatCents(detail.expectedProfitCents)} · ${formatPercent(detail.expectedMarginPercent)}`} />
        </Card>
        {detail.inputSnapshot && <Card>
          <Text style={s.groupLabel}>Entradas registradas naquele dia</Text>
          {detail.inputSnapshot.durationMinutes !== undefined && <Line label="Duração" value={`${detail.inputSnapshot.durationMinutes} minutos`} />}
          {detail.inputSnapshot.hourlyRate !== undefined && <Line label="Valor da hora" value={formatMoney(detail.inputSnapshot.hourlyRate)} />}
          {detail.inputSnapshot.monthlyFixedCosts !== undefined && <Line label="Custos fixos do mês" value={formatMoney(detail.inputSnapshot.monthlyFixedCosts)} />}
          {detail.inputSnapshot.desiredMarginPercent !== undefined && <Line label="Margem desejada" value={formatPercent(detail.inputSnapshot.desiredMarginPercent)} />}
          {detail.inputSnapshot.salesFeePercent !== undefined && <Line label="Taxa sobre venda" value={formatPercent(detail.inputSnapshot.salesFeePercent)} />}
          {detail.inputSnapshot.currentPrice !== undefined && <Line label="Preço praticado então" value={formatMoney(detail.inputSnapshot.currentPrice)} />}
        </Card>}
        <Text style={s.hint}>Este registro não é recalculado: mostra os valores da época, na versão {detail.calculationVersion} do cálculo.</Text>
      </>}
    </DetailSheet>

    <ServiceSheet visible={sheetOpen} service={service} onClose={() => setSheetOpen(false)} onSaved={() => { setResult(null); setBreakdown(null); }} onUpgrade={onUpgrade} />

    <FormSheet
      visible={expenseOpen}
      title="Nova despesa fixa"
      subtitle="O que sai todo mês, atendendo ou não."
      busy={expense.busy}
      error={expense.error}
      limitReached={expense.limitReached}
      onUpgrade={onUpgrade}
      onClose={() => setExpenseOpen(false)}
      onSubmit={saveExpense}
    >
      <Field label="Nome da despesa" value={expenseForm.name} onChangeText={value => setExpenseForm({ ...expenseForm, name: value })} placeholder="Ex.: Aluguel do espaço" />
      <ChoiceField label="Categoria" items={FIXED_COST_CATEGORIES.map(item => item.label)} value={expenseForm.category} onChange={value => setExpenseForm({ ...expenseForm, category: value })} />
      <Field label="Valor por mês" value={expenseForm.amount} onChangeText={value => setExpenseForm({ ...expenseForm, amount: value })} prefix="R$" numeric />
    </FormSheet>
  </Screen>;
}

// --- planos ---------------------------------------------------------------

const planNames: Record<string, string> = { FREE: 'Gratuito', PREMIUM: 'Premium', MASTER: 'Master' };
/**
 * Cartão de uma oferta: o preço que a pessoa lê antes de decidir.
 *
 * O valor grande é o do período escolhido, porque é o que será cobrado de uma
 * vez. O equivalente mensal aparece embaixo na anual, para comparar — nunca no
 * lugar do valor cobrado, que seria vender 299,00 anunciando 24,92.
 */
function OfferCard({ offer, selected, onSelect }: { offer: PlanOffer; selected: boolean; onSelect: () => void }) {
  const anual = offer.billingPeriod === 'ANNUAL';

  return <Card tone={selected ? 'pink' : 'neutral'} onPress={onSelect} accessibilityLabel={`${anual ? 'Plano anual' : 'Plano mensal'}, ${formatCents(offer.priceCents)}`}>
    <View style={s.offerHead}>
      <Text style={s.offerPeriod}>{anual ? 'Anual' : 'Mensal'}</Text>
      {anual && offer.savingsPercent !== null && <Badge label={`Economize ${offer.savingsPercent}%`} />}
    </View>
    <Text style={s.offerPrice}>{formatCents(offer.priceCents)}</Text>
    <Text style={s.offerCaption}>
      {anual
        ? `Cobrado uma vez por ano · sai por ${formatCents(offer.monthlyEquivalentCents)} por mês`
        : 'Cobrado todo mês'}
    </Text>
  </Card>;
}

export function PlansScreen({ onBack }: ScreenProps) {
  const app = useApp();
  const dialog = useDialog();
  const { busy, error, run } = useSubmit();
  const subscription = app.subscription;

  const [catalog, setCatalog] = useState<PlanCatalog | null>(null);
  const [chosen, setChosen] = useState<'MONTHLY' | 'ANNUAL' | null>(null);

  /**
   * O catálogo é público e não depende da sessão, então a falha aqui não é
   * motivo para esconder o resto da tela: sem ele o que some é a compra, e o
   * plano em vigor e os limites continuam visíveis.
   */
  useEffect(() => {
    let ativo = true;
    void getPlans()
      .then(data => { if (ativo) setCatalog(data); })
      .catch(() => { if (ativo) setCatalog({ offers: [], legal: LEGAL_FALLBACK }); });
    return () => { ativo = false; };
  }, []);

  if (!subscription) return <Screen><ScreenHeader title="Meu plano" onBack={onBack} /><Loading label="Conferindo sua assinatura..." full /></Screen>;

  const limits = subscription.limits;
  const used = (value: number, limit: number | null) => (limit === null ? `${value} · ilimitado` : `${value} de ${limit}`);

  const offers = catalog?.offers ?? [];
  const oferta = offers.find(item => item.billingPeriod === chosen) ?? offers[0] ?? null;

  // A assinatura que sustenta o plano em vigor. No gratuito não há nenhuma, e a
  // seção de cancelamento simplesmente não aparece.
  const paga = subscription.subscriptions.find(
    item => item.plan === subscription.plan && subscription.plan !== 'FREE',
  ) ?? null;

  const cancelar = (id: string) => {
    void run(async () => {
      await app.cancelSubscription(id);
      track('subscription_cancelled', { canal: paga?.channel ?? 'WEB' });
      dialog.inform({
        title: 'Cancelamento pedido',
        message: 'Avisamos o processador. Assim que ele confirmar, seu plano volta ao gratuito — e nada do que você cadastrou é apagado.',
      });
    });
  };

  const subscribe = () => {
    const token = app.token;
    const business = app.business;
    if (!token || !business || !oferta) return;

    track('checkout_started', { plan: oferta.plan, billingPeriod: oferta.billingPeriod });

    // O processador ainda não está configurado no servidor; quando não estiver,
    // a resposta explica isso e a mensagem sobe como está para a assinante.
    void run(async () => {
      const session = await startCheckout(
        { token, businessId: business.id },
        { plan: oferta.plan, billingPeriod: oferta.billingPeriod },
      );
      if (session.url) dialog.inform({ title: 'Continue no navegador', message: `Abra ${session.url} para concluir a assinatura.` });
    });
  };

  return <Screen>
    <ScreenHeader title="Meu plano" subtitle="Invista no seu crescimento" onBack={onBack} />
    <HeroCard
      label="Plano atual"
      value={planNames[subscription.plan] ?? subscription.plan}
      caption={subscription.managedIn ? `Gerenciado em ${subscription.managedIn}` : 'Sem cobrança recorrente'}
      hint="Você pode continuar no gratuito o quanto quiser"
    />
    <Section title="O que você já usa" first />
    <Row>
      <StatCard icon="tag" label="Serviços" value={used(app.services.length, limits.services)} />
      <StatCard icon="box" label="Materiais" value={used(app.materials.length, limits.materials)} tone="lilac" />
    </Row>
    <Row>
      <StatCard icon="wallet" label="Custos fixos" value={used(app.fixedCosts.length, limits.fixedCosts)} tone="lilac" />
      <StatCard icon="clock" label="Cálculos salvos" value={used(app.calculations.length, limits.calculations)} />
    </Row>

    {subscription.plan === 'FREE' && <>
      <Section title="Premium" />

      {catalog === null && <Loading label="Buscando os valores..." />}

      {catalog !== null && offers.length === 0 && (
        <Notice tone="warning" message="Os valores da assinatura estão indisponíveis no momento. Tente de novo daqui a pouco." />
      )}

      {offers.length > 0 && <>
        {offers.map(item => (
          <OfferCard
            key={item.billingPeriod}
            offer={item}
            selected={oferta?.billingPeriod === item.billingPeriod}
            onSelect={() => setChosen(item.billingPeriod)}
          />
        ))}

        <Card tone="lilac">
          {(oferta?.benefits ?? []).map(benefit => <View key={benefit} style={s.benefit}><Icon name="check" size={16} color={colors.accent} /><Text style={s.benefitText}>{benefit}</Text></View>)}
        </Card>

        {error && <Notice message={error} />}
        <Button label={busy ? 'Abrindo...' : `Assinar por ${formatCents(oferta?.priceCents ?? 0)}`} icon="sparkle" onPress={busy ? undefined : subscribe} />

        <Text style={s.legalText}>
          {oferta?.billingPeriod === 'ANNUAL'
            ? 'A assinatura é renovada automaticamente a cada ano, pelo preço vigente, até que você cancele.'
            : 'A assinatura é renovada automaticamente todo mês, pelo preço vigente, até que você cancele.'}
          {' '}Você pode cancelar quando quiser, sem multa, e o acesso continua até o fim do período já pago. Nada do que você cadastrou é apagado ao voltar para o gratuito.
        </Text>

        <View style={s.legalLinks}>
          <Text style={s.legalLink} onPress={() => void Linking.openURL(catalog?.legal.termsUrl ?? LEGAL_FALLBACK.termsUrl)}>Termos de Uso</Text>
          <Text style={s.legalSeparator}>·</Text>
          <Text style={s.legalLink} onPress={() => void Linking.openURL(catalog?.legal.privacyUrl ?? LEGAL_FALLBACK.privacyUrl)}>Política de Privacidade</Text>
        </View>
      </>}
    </>}

    {paga && <CancelSection subscription={paga} onCancel={cancelar} busy={busy} error={error} />}

    <Section title="Dúvidas" />
    <ListRow icon="help" title="Posso cancelar quando quiser?" subtitle="Sim, sem multa: o acesso segue até o fim do período pago." />
    <ListRow icon="lock" title="O que acontece com meus dados?" subtitle="Nada é apagado ao voltar para o gratuito." />
  </Screen>;
}

/**
 * Endereços usados quando o catálogo não chega.
 *
 * Os documentos precisam estar alcançáveis mesmo com a rede ruim: um link morto
 * na tela de assinatura é motivo de recusa nas lojas.
 */
const LEGAL_FALLBACK = {
  termsUrl: 'https://beautyconta.com.br/termos',
  privacyUrl: 'https://beautyconta.com.br/privacidade',
  supportEmail: 'suporte@beautyconta.com.br',
};

/** Onde cada loja manda a assinante para gerenciar o que comprou. */
const storeSubscriptions: Record<Exclude<SubscriptionChannel, 'WEB'>, { label: string; url: string }> = {
  ANDROID: { label: 'Google Play', url: 'https://play.google.com/store/account/subscriptions' },
  IOS: { label: 'App Store', url: 'https://apps.apple.com/account/subscriptions' },
};

/**
 * Cancelamento da assinatura.
 *
 * A regra da seção 4 do documento 11 aparece inteira aqui: **o cancelamento é
 * feito no canal que originou a cobrança**. Compra de loja não pode ser
 * cancelada pelo aplicativo — Google e Apple não expõem isso, e tentar
 * esconder a diferença deixaria a assinante achando que cancelou quando a
 * cobrança seguiria vindo. Então, quando a compra veio da loja, o que a tela
 * faz é levar até o lugar certo.
 */
function CancelSection({
  subscription,
  onCancel,
  busy,
  error,
}: {
  subscription: Subscription;
  onCancel: (id: string) => void;
  busy: boolean;
  error: string | null;
}) {
  const dialog = useDialog();
  const ate = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')
    : null;

  if (subscription.cancelAtPeriodEnd) {
    return <>
      <Section title="Assinatura" />
      <Notice
        tone="lilac"
        message={ate
          ? `Cancelamento pedido. Você continua com o Premium até ${ate}, e nada do que salvou é perdido.`
          : 'Cancelamento pedido. Você continua com o Premium até o fim do período já pago.'}
      />
    </>;
  }

  if (subscription.channel !== 'WEB') {
    const loja = storeSubscriptions[subscription.channel];
    return <>
      <Section title="Assinatura" />
      <ListRow
        icon="store"
        title={`Gerenciada na ${loja.label}`}
        subtitle={`O cancelamento é feito lá, e não por aqui — é a loja que cobra de você.${ate ? ` Período atual até ${ate}.` : ''}`}
      />
      <Button
        label={`Abrir assinaturas na ${loja.label}`}
        secondary
        icon="arrow"
        onPress={() => {
          void Linking.openURL(loja.url).catch(() =>
            dialog.inform({
              title: 'Não conseguimos abrir',
              message: `Procure por assinaturas nos ajustes da ${loja.label} para cancelar.`,
            }),
          );
        }}
      />
    </>;
  }

  return <>
    <Section title="Assinatura" />
    <ListRow
      icon="wallet"
      title="Assinatura pelo site"
      subtitle={ate ? `Renova em ${ate}` : 'Cobrança recorrente ativa'}
    />
    {error && <Notice message={error} />}
    <Button
      label={busy ? 'Cancelando...' : 'Cancelar assinatura'}
      secondary
      onPress={busy ? undefined : () => dialog.confirm({
        title: 'Cancelar a assinatura?',
        message: ate
          ? `Você continua com o Premium até ${ate}. Depois disso, sua conta volta ao gratuito e nada do que você cadastrou é apagado.`
          : 'Você continua com o Premium até o fim do período já pago. Depois disso, sua conta volta ao gratuito e nada do que você cadastrou é apagado.',
        confirmLabel: 'Cancelar assinatura',
        cancelLabel: 'Continuar assinante',
        onConfirm: () => onCancel(subscription.id),
      })}
    />
  </>;
}

const s = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  lineLabel: { color: colors.ink3, fontSize: 12 },
  lineValue: { color: colors.ink, fontSize: 12, fontWeight: '500' },
  lineStrong: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  method: { color: colors.faded, fontSize: 10, lineHeight: 16 },
  // Detalhe de uma linha da composição: recuado, para se ler como parte dela.
  subLine: { color: colors.ink3, fontSize: 11, lineHeight: 17, marginTop: -6, paddingLeft: 12 },
  groupLabel: { fontSize: 12, fontWeight: '500', color: colors.muted, marginBottom: 9 },
  hint: { color: colors.faded, fontSize: 11, lineHeight: 17, marginTop: 4 },
  editHint: { color: colors.faded, fontSize: 10, lineHeight: 16 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  offerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  offerPeriod: { color: colors.ink3, fontSize: 12, fontWeight: '600' },
  offerPrice: { color: colors.ink, fontSize: 26, fontWeight: '700', marginTop: 4 },
  offerCaption: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 2 },
  legalText: { color: colors.faded, fontSize: 11, lineHeight: 17, marginTop: -8, marginBottom: 12 },
  legalLinks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 },
  legalLink: { color: colors.accent, fontSize: 12, textDecorationLine: 'underline' },
  legalSeparator: { color: colors.faded, fontSize: 12 },
  benefitText: { color: colors.ink2, fontSize: 12, flex: 1 },
});
