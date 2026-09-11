import { colors } from '../theme';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { track } from '../lib/analytics';
import { FIXED_COST_CATEGORIES, guessMaterialCategory, labelOf, slugOf, UNITS } from '../lib/catalog';
import { configurePurchases, getStoreOfferings, purchasePackage, restorePurchases, storePurchaseAvailable, type StoreOffering } from '../lib/purchases';
import { getPlans, startCheckout, type AllocationMethod, type Calculation, type FixedCostBreakdown, type PaymentMethod, type PlanCatalog, type PlanOffer, type PricingResult, type RoundingStrategy, type Service, type Subscription, type SubscriptionChannel } from '../lib/resources';
import { centsToInput, formatCents, formatMoney, formatPercent, parseCents, parseNumber, useSubmit } from '../lib/useSubmit';
import { useApp } from '../state/AppProvider';
import { useDialog } from './Dialog';
import { Icon } from './AppChrome';
import { Badge, Button, Card, ChoiceField, DetailSheet, EmptyState, Field, FormSheet, HeroCard, Line, ListRow, Loading, Notice, PlanLimitNotice, Row, Screen, ScreenHeader, Section, StatCard, SwitchRow, ui } from './ui';
import { GoalSimulator } from './GoalSimulator';
import { PriceChooser } from './PriceChooser';
import { PublicCalculator } from './PublicCalculator';
import { ServiceSheet } from './ServiceSheet';

type ScreenProps = { onBack?: () => void; onUpgrade?: () => void };

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
/**
 * Um passo da linha do tempo vertical da calculadora.
 *
 * O trilho à esquerda responde "onde eu estou": passo feito vira check rosa,
 * o atual fica contornado, o que falta espera em lilás. A linha desce até o
 * passo seguinte e pinta de rosa quando o de cima está resolvido — é o mapa
 * de preenchimento que os rótulos soltos não davam.
 */
function TimelineStep({ number, title, hint, done, active, last, children }: PropsWithChildren<{ number: number; title: string; hint?: string; done?: boolean; active?: boolean; last?: boolean }>) {
  return <View style={s.tlRow}>
    <View style={s.tlRail}>
      <View style={[s.tlDot, active && !done && s.tlDotActive, done && s.tlDotDone]}>
        {done
          ? <Icon name="check" size={13} color={colors.white} />
          : <Text style={[s.tlNumber, active && s.tlNumberActive]}>{number}</Text>}
      </View>
      {!last && <View style={[s.tlLine, done && s.tlLineDone]} />}
    </View>
    <View style={s.tlBody}>
      <Text accessibilityRole="header" style={s.tlTitle}>{title}</Text>
      {hint && <Text style={s.tlHint}>{hint}</Text>}
      {children}
    </View>
  </View>;
}

export function PricingScreen({ onBack, onUpgrade, onEquipment }: ScreenProps & { onEquipment?: () => void }) {
  const app = useApp();
  const { busy, error, setError, run } = useSubmit();
  const expense = useSubmit();
  const [expenseForm, setExpenseForm] = useState({ name: '', category: FIXED_COST_CATEGORIES[0].label, amount: '' });
  /**
   * Cadastros dentro da linha do tempo, sem sair da tela.
   *
   * `materialMode` diz o que o passo 2 está mostrando: fechado (''), o
   * formulário de material novo ('new') ou o campo de consumo de um material
   * do estoque (o id dele). O passo 3 tem o equivalente para a despesa.
   */
  const materialAdd = useSubmit();
  const [materialMode, setMaterialMode] = useState('');
  const emptyNewMaterial = { name: '', price: '', quantity: '', unit: UNITS[0].label, used: '1' };
  const [newMaterial, setNewMaterial] = useState(emptyNewMaterial);
  const [stockUse, setStockUse] = useState('1');
  const [expenseAdding, setExpenseAdding] = useState(false);
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

  /** Taxa sobre a venda embutida no preço sugerido: preço − custo − lucro. */
  const resultFee = result ? result.commercialPrice - result.totalCost - result.expectedProfit : 0;

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

  /** Material do estoque entra na composição com o consumo informado. */
  const addFromStock = (materialId: string) => {
    if (!service) return;
    const used = parseNumber(stockUse);
    if (used <= 0) {
      materialAdd.setError('Diga quanto usa por atendimento.');
      return;
    }
    void materialAdd.run(async () => {
      await app.updateService(service.id, { materials: [...service.materials, { materialId, quantityUsed: used }] });
      setMaterialMode('');
      setStockUse('1');
      setResult(null);
      setBreakdown(null);
    });
  };

  /**
   * Cadastro de material sem sair da linha do tempo: o material entra no
   * estoque e na composição do serviço na mesma ação, como na ficha completa.
   */
  const createAndAddMaterial = () => {
    if (!service) return;
    const quantity = parseNumber(newMaterial.quantity);
    const used = parseNumber(newMaterial.used);
    if (!newMaterial.name.trim()) {
      materialAdd.setError('Dê um nome ao material.');
      return;
    }
    if (quantity <= 0) {
      materialAdd.setError('Diga quanto vem na embalagem que você compra.');
      return;
    }
    if (used <= 0) {
      materialAdd.setError('Diga quanto usa por atendimento.');
      return;
    }
    void materialAdd.run(async () => {
      const material = await app.createMaterial({
        name: newMaterial.name.trim(),
        // Sem perguntar: a categoria é organização de estoque, não dado de cálculo.
        category: guessMaterialCategory(newMaterial.name),
        purchasePriceCents: parseCents(newMaterial.price),
        purchaseQuantity: quantity,
        unit: slugOf(UNITS, newMaterial.unit),
      });
      await app.updateService(service.id, { materials: [...service.materials, { materialId: material.id, quantityUsed: used }] });
      setNewMaterial(emptyNewMaterial);
      setMaterialMode('');
      setResult(null);
      setBreakdown(null);
    });
  };

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
      setExpenseAdding(false);
      setResult(null);
      setBreakdown(null);
    });
  };

  return <View style={ui.grow}>
  <Screen>
    {!result && <>
    <ScreenHeader title="Calcular preço" subtitle="Descubra quanto cobrar sem trabalhar no prejuízo" onBack={onBack} />

    {/*
      Direção A do canvas aprovado, organizada como linha do tempo vertical:
      a tela é uma lista de serviços — inicial, duração e preço de hoje em
      cada linha — os custos entram como resumo, e a ação vive na barra fixa
      do rodapé. O trilho à esquerda mostra em que passo a pessoa está.
    */}
    <TimelineStep number={1} title="Escolha o serviço" hint="Toque no serviço que você vai precificar." done={!!service} active={!service}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Serviço a calcular">
        {selectable.map((item, index) => {
          const active = item.id === selected;
          const materialsLabel = item.materials.length
            ? `${item.materials.length} ${item.materials.length === 1 ? 'material' : 'materiais'}`
            : 'sem materiais';
          return <Pressable
            key={item.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${item.name}, ${item.durationMinutes} minutos, ${materialsLabel}`}
            onPress={() => {
              setSelected(item.id);
              setResult(null);
              setBreakdown(null);
              setSavedPrice(null);
            }}
            style={({ pressed }) => [s.serviceRow, active && s.serviceRowOn, pressed && ui.pressed]}
          >
            <View style={[s.avatar, { backgroundColor: active ? colors.white : index % 2 ? colors.softLilac : colors.softPink }]}>
              <Text style={[s.avatarText, { color: index % 2 && !active ? colors.info : colors.accent }]}>{item.name.trim().charAt(0).toUpperCase()}</Text>
            </View>
            <View style={ui.grow}>
              <Text style={[s.serviceName, active && s.serviceNameOn]}>{item.name}</Text>
              <Text style={s.serviceSub}>{item.durationMinutes} min · {materialsLabel}</Text>
            </View>
            {item.currentPriceCents
              ? <View style={s.serviceMeta}>
                <Text style={[s.servicePrice, active && s.servicePriceOn]}>{formatCents(item.currentPriceCents)}</Text>
                <Text style={s.serviceHint}>hoje</Text>
              </View>
              : <Text style={s.serviceEmpty}>sem preço</Text>}
            {active && <View style={s.serviceCheck}><Icon name="check" size={13} color={colors.white} /></View>}
          </Pressable>;
        })}
      </View>
      {service && service.materials.length === 0 && <Notice tone="lilac" message="Sem materiais na composição, o cálculo considera só o seu tempo e os custos fixos." action="Adicionar" onAction={() => setSheetOpen(true)} />}
      {service && <Pressable accessibilityRole="button" accessibilityLabel="Editar serviço e materiais" onPress={() => setSheetOpen(true)} style={({ pressed }) => [s.tlLink, pressed && ui.pressed]}>
        <Text style={ui.link}>Editar serviço e materiais</Text>
      </Pressable>}
    </TimelineStep>

    <TimelineStep number={2} title="Monte os materiais" hint={service ? 'O que é gasto em cada atendimento entra no custo.' : 'Escolha o serviço acima para montar a lista.'} done={!!service && service.materials.length > 0} active={!!service && service.materials.length === 0}>
      {service && <>
        {service.materials.length > 0 && <Card>
          {service.materials.map(item => {
            const material = app.materials.find(entry => entry.id === item.materialId);
            if (!material) return null;
            return <Line
              key={item.materialId}
              label={material.name}
              note={`${item.quantityUsed} ${labelOf(UNITS, material.unit).toLowerCase()}`}
              value={formatCents(Math.round((material.unitCostCents ?? 0) * item.quantityUsed))}
            />;
          })}
          <Line label="Custo de materiais" value={formatCents(materialCost)} strong total />
        </Card>}

        {/*
          Materiais já cadastrados que não estão neste serviço: um toque abre a
          única pergunta que falta — quanto se usa por atendimento.
        */}
        {materialMode !== 'new' && app.materials.some(entry => !entry.isArchived && !service.materials.some(used => used.materialId === entry.id)) && <View style={s.stockChips}>
          {app.materials.filter(entry => !entry.isArchived && !service.materials.some(used => used.materialId === entry.id)).map(entry => {
            const picked = materialMode === entry.id;
            return <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityState={{ selected: picked }}
              accessibilityLabel={`Incluir ${entry.name}`}
              onPress={() => { setMaterialMode(picked ? '' : entry.id); setStockUse('1'); materialAdd.setError(null); }}
              style={({ pressed }) => [ui.chip, picked && ui.chipActive, pressed && ui.pressed]}
            >
              <Text style={[ui.chipText, picked && ui.chipTextActive]}>+ {entry.name}</Text>
            </Pressable>;
          })}
        </View>}

        {materialMode !== '' && materialMode !== 'new' && <Card>
          <Field label="Quanto usa por atendimento" value={stockUse} onChangeText={setStockUse} numeric hint="na unidade em que o material foi cadastrado" />
          <Button label={materialAdd.busy ? 'Incluindo...' : 'Incluir no serviço'} icon="check" inline onPress={materialAdd.busy ? undefined : () => addFromStock(materialMode)} />
        </Card>}

        {materialMode === 'new' && <Card>
          <Field label="Nome do material" value={newMaterial.name} onChangeText={value => setNewMaterial({ ...newMaterial, name: value })} placeholder="Ex.: Esmalte em gel" />
          <Row>
            <View style={ui.grow}><Field label="Preço pago" value={newMaterial.price} onChangeText={value => setNewMaterial({ ...newMaterial, price: value })} prefix="R$" numeric /></View>
            <View style={ui.grow}><Field label="Vem na embalagem" value={newMaterial.quantity} onChangeText={value => setNewMaterial({ ...newMaterial, quantity: value })} numeric /></View>
          </Row>
          <ChoiceField label="Unidade" items={UNITS.map(item => item.label)} value={newMaterial.unit} onChange={value => setNewMaterial({ ...newMaterial, unit: value })} />
          <Field label="Quanto usa por atendimento" value={newMaterial.used} onChangeText={value => setNewMaterial({ ...newMaterial, used: value })} numeric />
          <Button label={materialAdd.busy ? 'Salvando...' : 'Cadastrar e incluir'} icon="check" inline onPress={materialAdd.busy ? undefined : createAndAddMaterial} />
        </Card>}

        {materialAdd.error && <Notice message={materialAdd.error} />}

        <View style={s.tlLinks}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cadastrar material novo" onPress={() => { setMaterialMode(materialMode === 'new' ? '' : 'new'); materialAdd.setError(null); }} style={({ pressed }) => [s.tlLink, pressed && ui.pressed]}>
            <Text style={ui.link}>{materialMode === 'new' ? 'Fechar cadastro' : '+ Cadastrar material novo'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Editar serviço e materiais" onPress={() => setSheetOpen(true)} style={({ pressed }) => [s.tlLink, pressed && ui.pressed]}>
            <Text style={ui.link}>Ficha completa</Text>
          </Pressable>
        </View>
      </>}
    </TimelineStep>

    <TimelineStep number={3} title="Confira seus custos" hint="O que sai todo mês entra no rateio de cada atendimento." done={app.fixedCosts.length > 0} active={!!service && app.fixedCosts.length === 0}>
      {app.fixedCosts.length > 0 && <Card>
        {app.fixedCosts.filter(item => item.isActive).map(item => (
          <Line key={item.id} label={item.name} note={labelOf(FIXED_COST_CATEGORIES, item.category)} value={formatCents(item.monthlyAmountCents)} />
        ))}
        {equipmentReserve > 0 && <Line label="Reserva para repor equipamentos" value={formatCents(equipmentReserve)} />}
        <Line label="Total por mês" value={formatCents(monthlyFixedTotal)} strong total />
      </Card>}
      {app.fixedCosts.length === 0 && <Notice tone="lilac" message="Cadastre o que sai todo mês, mesmo quando você não atende: é isso que o preço precisa cobrir." action="Adicionar despesa" onAction={() => { setExpenseAdding(true); expense.setError(null); }} />}

      {expenseAdding && <Card>
        <Field label="Nome da despesa" value={expenseForm.name} onChangeText={value => setExpenseForm({ ...expenseForm, name: value })} placeholder="Ex.: Aluguel do espaço" />
        <ChoiceField label="Categoria" items={FIXED_COST_CATEGORIES.map(item => item.label)} value={expenseForm.category} onChange={value => setExpenseForm({ ...expenseForm, category: value })} />
        <Field label="Valor por mês" value={expenseForm.amount} onChangeText={value => setExpenseForm({ ...expenseForm, amount: value })} prefix="R$" numeric />
        <Button label={expense.busy ? 'Salvando...' : 'Adicionar despesa'} icon="check" inline onPress={expense.busy ? undefined : saveExpense} />
      </Card>}
      {expense.error && expenseAdding && <Notice message={expense.error} />}

      <Pressable accessibilityRole="button" accessibilityLabel="Adicionar despesa fixa" onPress={() => { setExpenseAdding(!expenseAdding); expense.setError(null); }} style={({ pressed }) => [s.tlLink, pressed && ui.pressed]}>
        <Text style={ui.link}>{expenseAdding ? 'Fechar cadastro' : '+ Adicionar despesa fixa'}</Text>
      </Pressable>
    </TimelineStep>

    <TimelineStep number={4} title="Calcule o preço" hint="Confira o selecionado na barra abaixo e toque em Calcular." active={!!service} last>
      <Pressable accessibilityRole="button" accessibilityLabel="Fazer um cálculo avulso" onPress={() => { setMode('Cálculo rápido'); setResult(null); setBreakdown(null); setSavedPrice(null); setError(null); }} style={({ pressed }) => [s.tlLink, pressed && ui.pressed]}>
        <Text style={ui.link}>Ou fazer um cálculo avulso</Text>
      </Pressable>
    </TimelineStep>
    </>}

    {error && <Notice message={error} />}

    {result && service && <View accessibilityLiveRegion="polite">
      {/*
        Direção B do canvas aprovado: o resultado É a tela. O preço abre em
        destaque no topo escuro e a conta vem logo abaixo como recibo. A
        explicação da reserva de equipamentos (seção 11 do documento 07)
        continua colada na linha de custo fixo que ela infla — dentro do recibo
        e no aviso logo abaixo dele.
      */}
      <View style={s.resultHero}>
        <View style={s.resultHeroTop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar à escolha do serviço" onPress={() => { setResult(null); setBreakdown(null); }} style={({ pressed }) => [s.resultBack, pressed && ui.pressed]}>
            <View style={ui.flip}><Icon name="chevron" size={18} color={colors.lilac} /></View>
          </Pressable>
          <View style={s.resultChip}><Text style={s.resultChipText}>{service.name} · {service.durationMinutes} min</Text></View>
        </View>
        <View style={s.resultHeroBody}>
          <Text style={s.resultLabel}>Preço sugerido</Text>
          <Text style={s.resultPrice}>{formatMoney(result.commercialPrice || result.suggestedPrice)}</Text>
          <Text style={s.resultSub}>para fechar os {formatPercent(result.expectedMarginPercent)} de margem que você pediu</Text>
          <View style={s.resultPills}>
            <View style={s.resultPill}><Text style={s.resultPillText}>Mínimo {formatMoney(result.minimumPrice)}</Text></View>
            <View style={[s.resultPill, s.resultPillProfit]}><Text style={[s.resultPillText, s.resultPillProfitText]}>Lucro {formatMoney(result.expectedProfit)}</Text></View>
          </View>
        </View>
      </View>

      <View style={s.receipt}>
        <Text style={s.receiptTitle}>Como chegamos nesse valor</Text>
        <Line label="Materiais" value={formatMoney(result.materialCost)} />
        <Line label="Mão de obra" value={formatMoney(result.laborCost)} />
        <Line label="Custos fixos rateados" value={formatMoney(result.allocatedFixedCost)} />
        {reserveShareCents > 0 && <Text style={s.subLine}>Deste rateio, {formatCents(reserveShareCents)} é reserva para repor equipamentos.</Text>}
        {result.otherDirectCosts > 0 && <Line label="Outros custos diretos" value={formatMoney(result.otherDirectCosts)} />}
        <View style={s.dashed} />
        <Line label="Seu custo total" value={formatMoney(result.totalCost)} strong />
        {resultFee > 0.004 && <Line label={service.salesFeePercent > 0 ? `Taxa sobre a venda (${formatPercent(service.salesFeePercent)})` : 'Taxa sobre a venda'} value={formatMoney(resultFee)} />}
        <View style={s.dashed} />
        <Line label="Seu lucro" value={formatMoney(result.expectedProfit)} note={formatPercent(result.expectedMarginPercent)} strong tone="profit" />
        <Text style={s.method}>Rateio por {result.allocationMethod === 'productive_hour' ? 'hora produtiva' : 'atendimento'} · sua hora a {formatMoney(result.hourlyRate)}</Text>
      </View>

      {equipmentReserve > 0 && <Notice
        tone="lilac"
        message={`Dos ${formatCents(monthlyFixedTotal)} de custo fixo por mês, ${formatCents(equipmentReserve)} são a reserva para repor os seus equipamentos: um pouco guardado por mês para trocar o aparelho quando ele acabar. Por isso este preço é maior do que seria sem eles.`}
        action={onEquipment ? 'Ver equipamentos' : undefined}
        onAction={onEquipment}
      />}

      <PriceChooser
        result={result}
        feePercent={service.salesFeePercent}
        currentPrice={service.currentPriceCents ? service.currentPriceCents / 100 : null}
        busy={busy}
        onUse={usePrice}
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
          <Line label="Diferença para o recomendado" value={formatMoney(result.expectedProfit - result.currentProfit)} strong total />
        </Card>
      </>}

      {savedPrice !== null && <Notice tone="success" message={`Pronto: ${service.name} agora vale ${formatMoney(savedPrice)}, e o cálculo entrou no seu histórico.`} />}

      {/* Depois do preço vem a pergunta seguinte: isso dá para viver? (item A-04) */}
      <GoalSimulator
        totalCost={result.totalCost}
        feePercent={service.salesFeePercent}
        currentPrice={service.currentPriceCents ? service.currentPriceCents / 100 : null}
        monthlyAppointments={settings?.estimatedAppointmentsPerMonth ?? null}
        initialGoalCents={settings?.monthlyProfitGoalCents ?? null}
      />

      <Text style={s.hint}>Estimativa calculada com os dados que você informou.</Text>
      <View style={s.linksRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Refazer o cálculo" onPress={() => { setResult(null); setBreakdown(null); }} style={({ pressed }) => [s.sideAction, pressed && ui.pressed]}>
          <Text style={ui.link}>Refazer o cálculo</Text>
        </Pressable>
      </View>
    </View>}

    {!result && <>
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
    <View style={s.barSpacer} />
    </>}

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

  </Screen>

  {/* A barra da direção A: o selecionado e a ação, sempre à vista. */}
  {!result && service && <View style={s.bar}>
    <View style={ui.grow}>
      <Text style={s.barOverline}>Selecionado</Text>
      <Text style={s.barTitle}>{service.name}</Text>
      <Text style={s.barSub}>{service.durationMinutes} min · com os seus custos de hoje</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Calcular preço" onPress={busy ? undefined : calculate} style={({ pressed }) => [s.barButton, pressed && ui.pressed]}>
      <Text style={s.barButtonText}>{busy ? 'Calculando...' : 'Calcular'}</Text>
      {!busy && <Icon name="arrow" size={16} color={colors.white} />}
    </Pressable>
  </View>}
  </View>;
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
function OfferCard({ offer, selected, onSelect }: { offer: PlanOffer; selected: boolean; onSelect?: () => void }) {
  const anual = offer.billingPeriod === 'ANNUAL';

  // Sem `onSelect` o cartão não é botão: quando só há um plano à venda, um
  // cartão que responde ao toque sem mudar nada é ruído, e a leitora de tela o
  // anunciaria como algo a escolher.
  return <Card tone={selected ? 'pink' : 'neutral'} onPress={onSelect} accessibilityLabel={onSelect ? `${planNames[offer.plan]} ${anual ? 'anual' : 'mensal'}, ${formatCents(offer.priceCents)}` : undefined}>
    <View style={s.offerHead}>
      <Text style={s.offerPeriod}>{planNames[offer.plan]}</Text>
      {anual && offer.savingsPercent !== null && <Badge label={`Economize ${offer.savingsPercent}%`} />}
    </View>
    <Text style={s.offerPrice}>{formatCents(offer.priceCents)}</Text>
    <Text style={s.offerCaption}>
      {anual
        ? `Por ano · ${formatCents(offer.monthlyEquivalentCents)} por mês`
        : 'Por mês'}
    </Text>
  </Card>;
}

export function PlansScreen({ onBack }: ScreenProps) {
  const app = useApp();
  const dialog = useDialog();
  const { busy, error, run } = useSubmit();
  const subscription = app.subscription;

  const [catalog, setCatalog] = useState<PlanCatalog | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>('card');

  /**
   * O que a loja tem à venda, quando estamos dentro de um aplicativo de loja.
   *
   * Vazio na web e em Expo Go. Quando há, **o preço mostrado é o da loja**, não
   * o do nosso catálogo: o valor varia por país e moeda, e é o da loja que será
   * cobrado de verdade.
   */
  const [store, setStore] = useState<StoreOffering[]>([]);
  const [storeLoading, setStoreLoading] = useState(true);
  const naLoja = storePurchaseAvailable();
  /** Mesma regra da web: a loja também só oferece o mensal por enquanto. */
  const storeMensal = store.filter(item => item.billingPeriod !== 'ANNUAL');

  /**
   * O catálogo é público e não depende da sessão, então a falha aqui não é
   * motivo para esconder o resto da tela: sem ele o que some é a compra, e o
   * plano em vigor e os limites continuam visíveis.
   */
  useEffect(() => {
    let ativo = true;
    setCatalog(null);
    setCatalogError(null);
    void getPlans()
      .then(data => { if (ativo) setCatalog(data); })
      .catch(() => {
        if (ativo) {
          setCatalog({ offers: [], legal: LEGAL_FALLBACK });
          setCatalogError('Não conseguimos carregar os planos. Confira sua conexão e tente novamente.');
        }
      });
    return () => { ativo = false; };
  }, [attempt]);

  /**
   * Identifica a assinante na loja pelo **negócio**, nunca pelo e-mail: é esse
   * identificador que o webhook usa para saber a quem conceder o plano, e é o
   * único dado que precisa chegar ao RevenueCat.
   */
  const businessId = app.business?.id;

  useEffect(() => {
    if (!naLoja || !businessId) return;

    let ativo = true;
    setStore([]);
    setStoreLoading(true);
    void configurePurchases(businessId)
      .then(pronto => (pronto ? getStoreOfferings() : []))
      .then(ofertas => { if (ativo) setStore(ofertas); })
      .catch(() => undefined)
      .finally(() => { if (ativo) setStoreLoading(false); });

    return () => { ativo = false; };
  }, [naLoja, businessId, attempt]);

  if (!subscription) return <Screen><ScreenHeader title="Meu plano" onBack={onBack} /><Loading label="Conferindo sua assinatura..." full /></Screen>;

  const limits = subscription.limits;
  const used = (value: number, limit: number | null) => (limit === null ? `${value} · ilimitado` : `${value} de ${limit}`);

  /**
   * Só o mensal é vendido.
   *
   * O ADR-0007 adia o anual para a Fase 3, "somente depois de haver evidência
   * de retenção mensal" — vender um ano antes de saber se o produto retém
   * transfere o risco para a assinante. O catálogo do servidor já traz os dois
   * porque os preços estão decididos; o filtro fica aqui, para o dia em que a
   * decisão mudar ser uma linha e não uma migração.
   */
  const offers = (catalog?.offers ?? []).filter(item => item.billingPeriod === 'MONTHLY');
  const oferta = offers.find(item => `${item.plan}:${item.billingPeriod}` === chosen) ?? offers[0] ?? null;

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

  /**
   * Compra pela loja.
   *
   * O plano **não** é concedido aqui: a loja confirma, o RevenueCat avisa o
   * servidor, e o servidor decide. Por isso a mensagem fala em "confirmando" —
   * prometer o plano na hora seria afirmar o que ainda não é verdade.
   */
  const comprarNaLoja = (packageId: string) => {
    track('checkout_started', { plan: 'PREMIUM', billingPeriod: store.find(item => item.id === packageId)?.billingPeriod ?? 'UNKNOWN', paymentMethod: 'store' });

    void run(async () => {
      const resultado = await purchasePackage(packageId);
      if (resultado.status === 'cancelled') return;
      if (resultado.status === 'error') throw new Error(resultado.message);

      await app.reload();
      dialog.inform({
        title: 'Compra recebida',
        message: 'A loja confirmou. Seu plano é liberado assim que o pagamento for processado — costuma levar poucos instantes.',
      });
    });
  };

  /**
   * Restaurar compras.
   *
   * A Apple exige este caminho em todo aplicativo com assinatura: quem trocou de
   * aparelho ou reinstalou precisa recuperar o que já pagou sem pagar de novo.
   */
  const restaurar = () => {
    void run(async () => {
      const resultado = await restorePurchases();
      if (resultado.status === 'error') throw new Error(resultado.message);

      await app.reload();
      dialog.inform({
        title: 'Compras restauradas',
        message: 'Se havia uma assinatura ativa nesta conta da loja, ela volta a valer aqui.',
      });
    });
  };

  const subscribe = () => {
    const token = app.token;
    const business = app.business;
    if (!token || !business || !oferta) return;

    track('checkout_started', { plan: oferta.plan, billingPeriod: oferta.billingPeriod, paymentMethod: method });

    // O processador pode não estar configurado no servidor; quando não estiver,
    // a resposta explica isso e a mensagem sobe como está para a assinante.
    void run(async () => {
      const session = await startCheckout(
        { token, businessId: business.id },
        { plan: oferta.plan, billingPeriod: oferta.billingPeriod, paymentMethod: method },
      );

      // O servidor devolve `checkoutUrl`. Ler `url` era procurar um campo que
      // nunca existiu: o pedido dava certo e a assinante ficava olhando a tela
      // sem nada acontecer.
      const endereco = session.checkoutUrl ?? session.url;
      if (!endereco) return;

      // Abrir direto poupa um toque e evita que o endereço apareça na tela para
      // ser digitado à mão.
      const abriu = await Linking.openURL(endereco).then(() => true).catch(() => false);
      if (!abriu) {
        dialog.inform({ title: 'Continue no navegador', message: `Abra ${endereco} para concluir.` });
      }
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
    {/* Lista, e não cartões coloridos: são quatro números para comparar com o
        limite, e comparar exige lê-los na mesma coluna. */}
    <ListRow icon="tag" title="Serviços" meta={used(app.services.length, limits.services)} />
    <ListRow icon="box" title="Materiais" meta={used(app.materials.length, limits.materials)} />
    <ListRow icon="wallet" title="Custos fixos" meta={used(app.fixedCosts.length, limits.fixedCosts)} />
    <ListRow icon="clock" title="Cálculos salvos" meta={used(app.calculations.length, limits.calculations)} />

    {subscription.plan === 'FREE' && <>
      <Section title="Assinaturas" />

      {!naLoja && catalog === null && <Loading label="Buscando os valores..." />}

      {!naLoja && catalog !== null && offers.length === 0 && (
        <>
          <Notice tone="warning" message={catalogError ?? 'Os valores da assinatura estão indisponíveis no momento. Tente de novo daqui a pouco.'} />
          <Button label="Tentar novamente" secondary onPress={() => setAttempt(value => value + 1)} />
        </>
      )}

      {/*
        * Dentro do aplicativo de loja, quem vende é a loja — e quem manda no
        * preço é ela. O valor do nosso catálogo não aparece aqui: ele varia por
        * país e moeda, e mostrar um número diferente do que será cobrado é
        * exatamente o que faz a submissão ser recusada.
        */}
      {naLoja && <>
        {storeLoading && <Loading label="Buscando os planos da loja..." />}
        {!storeLoading && storeMensal.length === 0 && <>
          <Notice tone="warning" message="Não foi possível carregar os planos da loja. Confira sua conexão e tente novamente." />
          <Button label="Tentar novamente" secondary onPress={() => setAttempt(value => value + 1)} />
        </>}

        {storeMensal.map(item => (
          <Card key={item.id} onPress={busy ? undefined : () => comprarNaLoja(item.id)} accessibilityLabel={`Assinar ${item.billingPeriod === 'ANNUAL' ? 'plano anual' : 'plano mensal'} por ${item.priceLabel}`}>
            <View style={s.offerHead}>
              <Text style={s.offerPeriod}>{item.billingPeriod === 'ANNUAL' ? 'Anual' : 'Mensal'}</Text>
            </View>
            <Text style={s.offerPrice}>{item.priceLabel}</Text>
            <Text style={s.offerCaption}>Cobrado pela loja do seu aparelho</Text>
          </Card>
        ))}

        {storeMensal.length > 0 && <Card>
          {(offers[0]?.benefits ?? []).map(benefit => <View key={benefit} style={s.benefit}><Icon name="check" size={16} color={colors.accent} /><Text style={s.benefitText}>{benefit}</Text></View>)}
        </Card>}

        {error && <Notice message={error} />}

        <Text style={s.legalText}>
          A assinatura é renovada automaticamente ao fim de cada período, pelo preço vigente, até que você cancele. O cancelamento é feito nas assinaturas da sua conta da loja, e o acesso continua até o fim do período já pago. Nada do que você cadastrou é apagado ao voltar para o gratuito.
        </Text>

        {/*
          * Exigência da Apple em todo aplicativo com assinatura: quem trocou de
          * aparelho ou reinstalou precisa recuperar o que já pagou sem pagar de
          * novo. Sem este botão, a submissão é recusada.
          */}
        <Button label={busy ? 'Restaurando...' : 'Restaurar compras'} icon="download" secondary onPress={busy ? undefined : restaurar} />

        <View style={s.legalLinks}>
          <Text style={s.legalLink} onPress={() => void Linking.openURL(catalog?.legal.termsUrl ?? LEGAL_FALLBACK.termsUrl)}>Termos de Uso</Text>
          <Text style={s.legalSeparator}>·</Text>
          <Text style={s.legalLink} onPress={() => void Linking.openURL(catalog?.legal.privacyUrl ?? LEGAL_FALLBACK.privacyUrl)}>Política de Privacidade</Text>
        </View>
      </>}

      {!naLoja && offers.length > 0 && <>
        {/* Lado a lado: quem escolhe entre dois planos compara preço com
            preço, e empilhados isso exigia rolar de um para o outro. */}
        <Row>
          {offers.map(item => (
            <View key={`${item.plan}:${item.billingPeriod}`} style={ui.grow}>
              <OfferCard
                offer={item}
                selected={oferta?.plan === item.plan && oferta.billingPeriod === item.billingPeriod}
                {...(offers.length > 1 ? { onSelect: () => setChosen(`${item.plan}:${item.billingPeriod}`) } : {})}
              />
            </View>
          ))}
        </Row>

        <Card tone="lilac">
          {(oferta?.benefits ?? []).map(benefit => <View key={benefit} style={s.benefit}><Icon name="check" size={16} color={colors.accent} /><Text style={s.benefitText}>{benefit}</Text></View>)}
        </Card>

        {/*
          * A escolha só aparece na web. Dentro do aplicativo de loja, Apple e
          * Google exigem que conteúdo digital seja comprado pelo sistema delas
          * — mandar a assinante para o Mercado Pago ali é motivo de recusa.
          */}
        {Platform.OS === 'web' && <>
          <ChoiceField
            label="Como você prefere pagar?"
            items={['Cartão', 'Pix']}
            value={method === 'card' ? 'Cartão' : 'Pix'}
            onChange={value => setMethod(value === 'Pix' ? 'pix' : 'card')}
            spread
            hint={method === 'card' ? 'Renova sozinho todo mês.' : 'Sem renovação automática: você paga quando quiser continuar.'}
          />
        </>}

        {error && <Notice message={error} />}
        <Button label={busy ? 'Abrindo...' : `Assinar por ${formatCents(oferta?.priceCents ?? 0)}`} icon="sparkle" onPress={busy ? undefined : subscribe} />

        {/*
          * Dizer "renova automaticamente" num pagamento por Pix seria mentira: o
          * Mercado Pago não faz cobrança recorrente por Pix, e a assinante
          * descobriria isso pelo acesso que parou sem aviso.
          */}
        <Text style={s.legalText}>
          {method === 'pix' && Platform.OS === 'web'
            ? `Pagamento único por Pix: o plano vale ${oferta?.billingPeriod === 'ANNUAL' ? 'um ano' : 'um mês'} e não renova sozinho. Quando terminar, é só pagar de novo para continuar.`
            : oferta?.billingPeriod === 'ANNUAL'
              ? 'A assinatura é renovada automaticamente a cada ano, pelo preço vigente, até que você cancele.'
              : 'A assinatura é renovada automaticamente todo mês, pelo preço vigente, até que você cancele.'}
          {method === 'pix' && Platform.OS === 'web'
            ? ' Nada do que você cadastrou é apagado ao voltar para o gratuito.'
            : ' Você pode cancelar quando quiser, sem multa, e o acesso continua até o fim do período já pago. Nada do que você cadastrou é apagado ao voltar para o gratuito.'}
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
  /** Metodologia, não valor: separada do corpo da conta por uma régua. */
  method: { color: colors.faded, fontSize: 10, lineHeight: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 2 },
  // Detalhe de uma linha da composição: recuado, para se ler como parte dela.
  subLine: { color: colors.ink3, fontSize: 11, lineHeight: 17, marginTop: -6, paddingLeft: 12 },
  groupLabel: { fontSize: 12, fontWeight: '500', color: colors.muted, marginBottom: 9 },
  hint: { color: colors.faded, fontSize: 11, lineHeight: 17, marginTop: 4 },
  sideAction: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12 },
  linksRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 6, marginBottom: 8 },

  // --- direção A: linha do tempo, lista de serviços e barra fixa ---------
  tlRow: { flexDirection: 'row', gap: 12 },
  tlRail: { width: 28, alignItems: 'center' },
  tlDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.softLilac, alignItems: 'center', justifyContent: 'center' },
  tlDotActive: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.accent },
  tlDotDone: { backgroundColor: colors.accent },
  tlNumber: { fontSize: 13, fontWeight: '700', color: colors.outline },
  tlNumberActive: { color: colors.accent },
  /** A linha que desce ao próximo passo; rosa quando o de cima está pronto. */
  tlLine: { width: 2, flexGrow: 1, borderRadius: 1, backgroundColor: colors.border, marginVertical: 4 },
  tlLineDone: { backgroundColor: colors.marker },
  tlBody: { flex: 1, minWidth: 0, paddingBottom: 20 },
  tlTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.3, color: colors.ink, marginBottom: 3 },
  tlHint: { fontSize: 11, color: colors.muted, marginBottom: 12 },
  tlLink: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', marginTop: 2 },
  tlLinks: { flexDirection: 'row', gap: 16 },
  stockChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 13 },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 9 },
  serviceRowOn: { backgroundColor: colors.softPink, borderWidth: 1.5, borderColor: colors.accent },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '600' },
  serviceName: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2, color: colors.ink2 },
  serviceNameOn: { color: colors.ink },
  serviceSub: { fontSize: 11, color: colors.ink3, marginTop: 4 },
  serviceMeta: { alignItems: 'flex-end', gap: 3 },
  servicePrice: { fontSize: 14, fontWeight: '600', color: colors.ink2, fontVariant: ['tabular-nums'] },
  servicePriceOn: { color: colors.accent },
  serviceHint: { fontSize: 10, color: colors.faded },
  serviceEmpty: { fontSize: 11, color: colors.faded, fontStyle: 'italic' },
  serviceCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 26, shadowColor: colors.ink, shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 12 },
  barOverline: { fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.faded },
  barTitle: { fontSize: 14, fontWeight: '600', color: colors.ink, marginTop: 3 },
  barSub: { fontSize: 11, color: colors.ink3, marginTop: 3 },
  barButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: 28, paddingVertical: 15, paddingHorizontal: 22 },
  barButtonText: { fontSize: 14, fontWeight: '600', color: colors.white },
  barSpacer: { height: 104 },

  // --- direção B: preço no topo escuro e conta como recibo ---------------
  resultHero: { backgroundColor: colors.ink, marginHorizontal: -22, marginTop: -16, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 54 },
  resultHeroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginBottom: 10 },
  resultBack: { width: 40, height: 40, borderRadius: 21, backgroundColor: 'rgba(255, 255, 255, 0.12)', alignItems: 'center', justifyContent: 'center' },
  resultChip: { backgroundColor: 'rgba(255, 255, 255, 0.14)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  resultChipText: { fontSize: 11, color: colors.lilac },
  resultHeroBody: { alignItems: 'center', gap: 6, paddingTop: 6 },
  resultLabel: { fontSize: 12, fontWeight: '500', color: colors.lilac },
  resultPrice: { fontSize: 46, fontWeight: '700', letterSpacing: -1.8, color: colors.white, fontVariant: ['tabular-nums'] },
  resultSub: { fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', textAlign: 'center' },
  resultPills: { flexDirection: 'row', gap: 8, marginTop: 10 },
  resultPill: { backgroundColor: 'rgba(255, 255, 255, 0.12)', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 6 },
  resultPillText: { fontSize: 11, color: colors.lilac },
  resultPillProfit: { backgroundColor: 'rgba(218, 91, 141, 0.35)' },
  resultPillProfitText: { color: colors.white, fontWeight: '600' },
  /** O recibo invade o topo escuro: a conta pertence ao preço. */
  receipt: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 19, paddingHorizontal: 16, paddingVertical: 18, marginTop: -38, marginBottom: 13, gap: 9, shadowColor: colors.ink, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 8 },
  receiptTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.faded },
  dashed: { borderBottomWidth: 1, borderStyle: 'dashed', borderColor: colors.trail, marginVertical: 4 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  offerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  offerPeriod: { color: colors.ink3, fontSize: 12, fontWeight: '600' },
  offerPrice: { color: colors.ink, fontSize: 22, fontWeight: '700', letterSpacing: -0.6, marginTop: 4 },
  offerCaption: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 2 },
  legalText: { color: colors.faded, fontSize: 11, lineHeight: 17, marginTop: -8, marginBottom: 12 },
  legalLinks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 },
  legalLink: { color: colors.accent, fontSize: 12, textDecorationLine: 'underline' },
  legalSeparator: { color: colors.faded, fontSize: 12 },
  benefitText: { color: colors.ink2, fontSize: 12, flex: 1 },
});
