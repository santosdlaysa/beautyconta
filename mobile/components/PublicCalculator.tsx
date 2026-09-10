import { colors } from '../theme';
import { useEffect, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { track } from '../lib/analytics';
import { SERVICE_CATEGORIES } from '../lib/catalog';
import { calculatePrice, type PublicPricingInput, type PricingResult } from '../lib/resources';
import { formatMoney, formatPercent, parseCents, parseNumber, useSubmit } from '../lib/useSubmit';
import { GoalSimulator } from './GoalSimulator';
import { Button, Card, ChoiceField, Field, HeroCard, Loading, Notice, Row, Screen, ScreenHeader, Section, StatCard, ui } from './ui';

/**
 * Calculadora pública, a jornada da seção 2 do documento 02.
 *
 * Roda sem cadastro por decisão de produto: é o principal caminho de aquisição
 * e não pode ficar atrás da entrada. A mesma tela serve quem já tem conta — aí
 * ela chega preenchida com os números do negócio e pode salvar no histórico.
 */

const ROUNDINGS = [
  { label: 'Sem arredondar', slug: 'none' },
  { label: 'Múltiplo de R$ 1', slug: '1' },
  { label: 'Múltiplo de R$ 5', slug: '5' },
  { label: 'Múltiplo de R$ 10', slug: '10' },
  { label: 'Terminar em 90', slug: '90' },
] as const;

const HOUR_MODES = ['Sei quanto quero por hora', 'Calcular pela minha retirada'] as const;

const ESTIMATE_NOTE = 'Estimativa calculada com os dados que você informou.';

export type CalculatorPrefill = {
  hourlyRate?: number;
  monthlyFixedCosts?: number;
  monthlyProductiveHours?: number;
  desiredMonthlyWithdrawal?: number;
  /** Só o simulador de meta usa: quantos atendimentos o negócio espera no mês. */
  monthlyAppointments?: number;
  /** Também só do simulador: a meta de lucro guardada na configuração. */
  monthlyProfitGoalCents?: number | null;
};

type Props = {
  onBack?: () => void;
  prefill?: CalculatorPrefill;
  /** Visitante: convite para criar conta e guardar o cálculo. */
  onSignUp?: (input: PublicPricingInput, serviceName: string) => void;
  /** Com conta: grava o cálculo no histórico. */
  onSave?: (input: PublicPricingInput) => Promise<void>;
};

/** Reais digitados passam por centavos inteiros: evita 0,1 + 0,2 virar 0,30000004. */
const reais = (text: string): number => parseCents(text) / 100;

export function PublicCalculator({ onBack, prefill, onSignUp, onSave }: Props) {
  const calculation = useSubmit();
  const saving = useSubmit();
  const [form, setForm] = useState({
    category: SERVICE_CATEGORIES[0].label,
    material: '',
    duration: '90',
    hourMode: HOUR_MODES[prefill?.hourlyRate ? 0 : 1] as string,
    hourlyRate: prefill?.hourlyRate ? prefill.hourlyRate.toFixed(2).replace('.', ',') : '',
    withdrawal: prefill?.desiredMonthlyWithdrawal ? prefill.desiredMonthlyWithdrawal.toFixed(2).replace('.', ',') : '3.000,00',
    fixedCosts: prefill?.monthlyFixedCosts ? prefill.monthlyFixedCosts.toFixed(2).replace('.', ',') : '',
    productiveHours: String(prefill?.monthlyProductiveHours ?? 120),
    fee: '0',
    margin: '30',
    currentPrice: '',
    rounding: ROUNDINGS[0].label as string,
  });
  const [result, setResult] = useState<PricingResult | null>(null);
  const [sent, setSent] = useState<PublicPricingInput | null>(null);
  const [saved, setSaved] = useState(false);
  const [simulated, setSimulated] = useState('');

  const set = (values: Partial<typeof form>) => setForm({ ...form, ...values });

  // Topo do funil do documento 05: é contra este número que a conversão da
  // calculadora é medida.
  useEffect(() => {
    track('calculator_viewed', { origem: onSignUp ? 'publica' : 'avulso' });
  }, [onSignUp]);

  const productiveHours = parseNumber(form.productiveHours);
  const byWithdrawal = form.hourMode === HOUR_MODES[1];
  const hourlyRate = byWithdrawal
    ? (productiveHours > 0 ? reais(form.withdrawal) / productiveHours : 0)
    : reais(form.hourlyRate);

  const submit = () => {
    const duration = Math.round(parseNumber(form.duration));
    if (duration <= 0) {
      calculation.setError('Informe quantos minutos o atendimento leva.');
      return;
    }
    if (productiveHours <= 0) {
      calculation.setError('Informe quantas horas por mês você realmente atende.');
      return;
    }

    const currentPrice = form.currentPrice.trim() ? reais(form.currentPrice) : undefined;
    const input: PublicPricingInput = {
      materialCost: reais(form.material),
      durationMinutes: duration,
      hourlyRate: Math.round(hourlyRate * 100) / 100,
      monthlyFixedCosts: reais(form.fixedCosts),
      monthlyProductiveHours: productiveHours,
      salesFeePercent: parseNumber(form.fee),
      desiredMarginPercent: parseNumber(form.margin),
      roundingStrategy: ROUNDINGS.find(item => item.label === form.rounding)?.slug ?? 'none',
      ...(currentPrice !== undefined ? { currentPrice } : {}),
    };

    track('calculation_started', { origem: onSignUp ? 'publica' : 'avulso' });
    void calculation.run(async () => {
      const calculated = await calculatePrice(input);
      setResult(calculated);
      setSent(input);
      setSaved(false);
      setSimulated('');
      track('calculation_completed', { origem: onSignUp ? 'publica' : 'avulso' });
    });
  };

  const share = () => {
    if (!result) return;
    void Share.share({
      message: [
        `${form.category} · ${form.duration} minutos`,
        `Preço recomendado: ${formatMoney(result.commercialPrice)}`,
        `Preço mínimo, sem lucro: ${formatMoney(result.minimumPrice)}`,
        `Seu custo: ${formatMoney(result.totalCost)}`,
        `Lucro estimado: ${formatMoney(result.expectedProfit)} (${formatPercent(result.expectedMarginPercent)})`,
        ESTIMATE_NOTE,
        'Calculado no BeautyConta.',
      ].join('\n'),
    });
  };

  const store = () => {
    if (!sent) return;
    if (onSignUp) {
      onSignUp(sent, form.category);
      return;
    }
    if (!onSave) return;
    void saving.run(async () => {
      await onSave(sent);
      setSaved(true);
    });
  };

  return (
    <Screen>
      <ScreenHeader
        title="Quanto cobrar?"
        subtitle={onSignUp ? 'Sem cadastro: informe seus números e veja o preço' : 'Um cálculo avulso com os seus números'}
        onBack={onBack}
      />

      <Card>
        <ChoiceField label="Tipo de serviço" items={SERVICE_CATEGORIES.map(item => item.label)} value={form.category} onChange={value => set({ category: value })} />
        <Pair>
          <Field label="Custo dos materiais" value={form.material} onChangeText={value => set({ material: value })} prefix="R$" placeholder="0,00" numeric />
          <Field label="Duração (minutos)" value={form.duration} onChangeText={value => set({ duration: value })} numeric />
        </Pair>
      </Card>

      <Section title="A sua hora de trabalho" first />
      <Card>
        <ChoiceField
          label="Como definir o valor da hora"
          items={HOUR_MODES}
          value={form.hourMode}
          onChange={value => set({ hourMode: value })}
          hint="Contamos só as horas de atendimento: compras, limpeza e redes sociais não entram."
        />
        {byWithdrawal
          ? <Field label="Quanto quer retirar por mês" value={form.withdrawal} onChangeText={value => set({ withdrawal: value })} prefix="R$" numeric />
          : <Field label="Quanto quer ganhar por hora" value={form.hourlyRate} onChangeText={value => set({ hourlyRate: value })} prefix="R$" placeholder="0,00" numeric />}
        <Field
          label="Horas que você atende por mês"
          value={form.productiveHours}
          onChangeText={value => set({ productiveHours: value })}
          numeric
          hint={`${formatMoney(hourlyRate)} / hora`}
        />
        <Field label="Custos fixos por mês" value={form.fixedCosts} onChangeText={value => set({ fixedCosts: value })} prefix="R$" placeholder="0,00" numeric hint="aluguel, energia, internet" />
      </Card>

      <Section title="Margem, taxas e preço atual" />
      <Card>
        <Pair>
          <Field label="Margem desejada (%)" value={form.margin} onChangeText={value => set({ margin: value })} numeric />
          <Field label="Taxa sobre venda (%)" value={form.fee} onChangeText={value => set({ fee: value })} numeric hint="cartão, Pix" />
        </Pair>
        <Field label="Preço que você cobra hoje" value={form.currentPrice} onChangeText={value => set({ currentPrice: value })} prefix="R$" placeholder="opcional" numeric />
        <ChoiceField label="Arredondamento do preço" items={ROUNDINGS.map(item => item.label)} value={form.rounding} onChange={value => set({ rounding: value })} />
      </Card>

      {calculation.error && <Notice message={calculation.error} />}
      <Button label={calculation.busy ? 'Calculando...' : 'Calcular meu preço'} icon="arrow" onPress={calculation.busy ? undefined : submit} />

      {calculation.busy && !result && <Loading label="Conversando com a calculadora..." />}

      {result && sent && <View accessibilityLiveRegion="polite">
        <PriceResult result={result} title={form.category} />

        <Section title="E se eu cobrasse outro preço?" />
        <Card>
          <Field label="Preço que quero simular" value={simulated} onChangeText={setSimulated} prefix="R$" placeholder="0,00" numeric />
          <Simulation price={reais(simulated)} totalCost={result.totalCost} feePercent={sent.salesFeePercent} />
          <Text style={s.hint}>Simular não altera nada do que está salvo.</Text>
        </Card>

        {/* Depois do preço vem a pergunta seguinte: isso dá para viver? (item A-04) */}
        <GoalSimulator
          totalCost={result.totalCost}
          feePercent={sent.salesFeePercent}
          currentPrice={sent.currentPrice ?? null}
          monthlyAppointments={prefill?.monthlyAppointments ?? null}
          initialGoalCents={prefill?.monthlyProfitGoalCents ?? null}
        />

        <Button label="Compartilhar resumo" icon="arrow" secondary onPress={share} />

        {saving.error && <Notice message={saving.error} />}
        {saved
          ? <Notice tone="success" message="Cálculo salvo no seu histórico." />
          : (onSignUp || onSave) && <Button
            label={onSignUp ? 'Criar conta e salvar este cálculo' : saving.busy ? 'Salvando...' : 'Salvar no histórico'}
            icon={onSignUp ? 'sparkle' : 'check'}
            secondary={!onSignUp}
            onPress={saving.busy ? undefined : store}
          />}
        {onSignUp && <Text style={s.hint}>Seus números ficam só neste aparelho até você criar a conta.</Text>}
      </View>}
    </Screen>
  );
}

/** Composição do resultado, item C-03: cada parcela aparece com o seu nome. */
export function PriceResult({ result, title }: { result: PricingResult; title: string }) {
  const fee = result.commercialPrice - result.totalCost - result.expectedProfit;
  const belowCost = result.currentProfit !== undefined && result.currentProfit <= 0;
  const belowMargin =
    result.currentMarginPercent !== undefined &&
    !belowCost &&
    result.currentMarginPercent < result.expectedMarginPercent;

  return <>
    <HeroCard
      label="Preço recomendado"
      value={formatMoney(result.commercialPrice)}
      caption={title}
      hint={`Preço mínimo, sem lucro: ${formatMoney(result.minimumPrice)}`}
    />

    <Section title="Como chegamos nesse valor" first />
    <Card>
      <Line label="Materiais" value={formatMoney(result.materialCost)} />
      <Line label="Mão de obra" value={formatMoney(result.laborCost)} />
      <Line label="Custos fixos rateados" value={formatMoney(result.allocatedFixedCost)} />
      {result.otherDirectCosts > 0 && <Line label="Outros custos diretos" value={formatMoney(result.otherDirectCosts)} />}
      <Line label="Seu custo total" value={formatMoney(result.totalCost)} strong />
      {fee > 0.004 && <Line label="Taxa sobre a venda" value={formatMoney(fee)} />}
      <Line label="Seu lucro" value={`${formatMoney(result.expectedProfit)} · ${formatPercent(result.expectedMarginPercent)}`} strong />
      <Text style={s.method}>
        Rateio por {result.allocationMethod === 'productive_hour' ? 'hora produtiva' : 'atendimento'} · sua hora a {formatMoney(result.hourlyRate)}
        {result.commercialPrice !== result.suggestedPrice ? ` · calculado em ${formatMoney(result.suggestedPrice)} e arredondado` : ''}
      </Text>
    </Card>

    <Row>
      <StatCard icon="trend" label="Lucro por atendimento" value={formatMoney(result.expectedProfit)} caption={`Margem de ${formatPercent(result.expectedMarginPercent)}`} />
      <StatCard icon="wallet" label="Preço mínimo" value={formatMoney(result.minimumPrice)} caption="Cobre o custo, sem lucro" tone="lilac" />
    </Row>

    {result.currentProfit !== undefined && <>
      <Section title="Comparado ao que você cobra hoje" />
      {belowCost && <Notice message="O preço que você cobra hoje não cobre o seu custo: cada atendimento sai do seu bolso." />}
      {belowMargin && <Notice tone="warning" message="O preço de hoje dá lucro, mas abaixo da margem que você pediu." />}
      <Card>
        <Line label="Lucro no preço de hoje" value={formatMoney(result.currentProfit)} />
        {result.currentMarginPercent !== undefined && <Line label="Margem de hoje" value={formatPercent(result.currentMarginPercent)} />}
        <Line label="Diferença para o recomendado" value={formatMoney(result.expectedProfit - result.currentProfit)} strong />
      </Card>
    </>}

    <Text style={s.hint}>{ESTIMATE_NOTE}</Text>
  </>;
}

/**
 * Simulador do `RF-09`.
 *
 * O lucro desconta a taxa sobre a venda, e não só o custo — a correção pedida
 * pelo item C-02. A conta é a mesma do motor, feita aqui para responder
 * enquanto a usuária digita, sem uma ida à rede por tecla.
 */
function Simulation({ price, totalCost, feePercent }: { price: number; totalCost: number; feePercent: number }) {
  if (price <= 0) return <Text style={s.hint}>Digite um preço para ver o lucro e a margem.</Text>;

  const profit = price - totalCost - price * (feePercent / 100);
  const margin = (profit / price) * 100;

  return <View>
    <Line label="Lucro nesse preço" value={formatMoney(profit)} strong />
    <Line label="Margem nesse preço" value={formatPercent(margin)} />
    {profit <= 0 && <Notice message="Nesse preço você trabalha no prejuízo." />}
  </View>;
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <View style={s.line}><Text style={[s.lineLabel, strong && s.lineStrong]}>{label}</Text><Text style={[s.lineValue, strong && s.lineStrong]}>{value}</Text></View>;
}

function Pair({ children }: { children: [React.ReactNode, React.ReactNode] }) {
  return <Row><View style={ui.grow}>{children[0]}</View><View style={ui.grow}>{children[1]}</View></Row>;
}

const s = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 26 },
  lineLabel: { color: colors.ink3, fontSize: 12 },
  lineValue: { color: colors.ink, fontSize: 12, fontWeight: '500' },
  lineStrong: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  method: { color: colors.faded, fontSize: 10, lineHeight: 16 },
  hint: { color: colors.faded, fontSize: 11, lineHeight: 17, marginBottom: 14 },
});
