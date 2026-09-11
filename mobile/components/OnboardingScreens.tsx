import { colors } from '../theme';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { track } from '../lib/analytics';
import { SEGMENTS, SERVICE_CATEGORIES, WORK_MODELS, labelOf, slugOf } from '../lib/catalog';
import {
  STEPS,
  emptyDraft,
  forgetDraft,
  readDraft,
  saveDraft,
  type OnboardingDraft,
  type Step,
} from '../lib/onboarding';
import type { Calculation } from '../lib/resources';
import { formatCents, formatMoney, parseCents, parseNumber, useSubmit } from '../lib/useSubmit';
import { useApp } from '../state/AppProvider';
import { Brand } from './AuthScreens';
import { Badge, Button, Card, ChoiceField, Field, HeroCard, Line, Loading, Notice, ProgressBar, Row, Screen, ScreenHeader, Section, StatCard, ui } from './ui';

/**
 * Onboarding em cinco etapas (item D-02, seção 3 do documento 02).
 *
 * As três exigências do backlog moldam a tela: **progresso salvo a cada etapa**,
 * **possibilidade de pular** e **primeiro resultado ao final**.
 *
 * Como a API não tem rota de rascunho, o progresso é resolvido em dois níveis.
 * Tudo o que a usuária digita é gravado no aparelho a cada avanço, em
 * `lib/onboarding.ts`; e o que já forma um cadastro completo sobe na hora — o
 * negócio ao fim da etapa 2, a configuração ao fim da etapa 4. Fechar o
 * aplicativo no meio não custa nada: a próxima abertura reencontra a etapa e os
 * campos.
 *
 * Pular nunca deixa buraco: a etapa pulada usa o padrão sugerido e o resumo
 * final diz em que tela completá-la depois. Nada do que a usuária responde fica
 * só no aparelho: as outras categorias atendidas sobem junto com o negócio, e a
 * meta de lucro junto com a configuração.
 */

const HOURLY_MODES = ['Calcular pela minha retirada', 'Eu digo quanto quero por hora'] as const;

const titles: Record<Step, { title: string; subtitle: string }> = {
  atuacao: { title: 'O que você faz.', subtitle: 'Começamos pelo seu principal serviço.' },
  trabalho: { title: 'Onde você atende.', subtitle: 'O modelo muda os custos que entram na conta.' },
  capacidade: { title: 'Quanto você atende.', subtitle: 'São essas horas que dividem os seus custos.' },
  objetivo: { title: 'Quanto você quer ganhar.', subtitle: 'Daqui sai o valor da sua hora de trabalho.' },
  resultado: { title: 'Seu primeiro preço.', subtitle: 'Um serviço que você faz muito, calculado agora.' },
};

/** Onde cada etapa pulada pode ser completada depois, com o nome da tela. */
const whereToFinish: Record<Step, string> = {
  atuacao: 'Perfil, em "Dados do negócio"',
  trabalho: 'Perfil, em "Dados do negócio"',
  capacidade: 'Custos, em "Sua hora de trabalho e o rateio"',
  objetivo: 'Custos, em "Sua hora de trabalho e o rateio"',
  resultado: 'Calcular, a qualquer momento',
};

export function OnboardingView() {
  const app = useApp();
  const { busy, error, setError, run } = useSubmit();
  const [draft, setDraft] = useState<OnboardingDraft>(emptyDraft);
  const [loaded, setLoaded] = useState(false);
  const [result, setResult] = useState<Calculation | null>(null);
  const [service, setService] = useState({
    name: '',
    category: SERVICE_CATEGORIES[0].label,
    duration: '90',
    materialCost: '',
    margin: '30',
  });
  const [savedService, setSavedService] = useState(false);

  const business = app.business;

  /**
   * Rascunho do aparelho na abertura, e só na abertura.
   *
   * O que já está no servidor manda no que ele sabe, porque foi de lá que a
   * etapa anterior voltou confirmada. Reler depois seria pior do que não ler:
   * o negócio gravado na etapa 2 muda o estado e devolveria a usuária para a
   * etapa em que o rascunho estava quando a gravação começou.
   */
  useEffect(() => {
    let alive = true;
    void readDraft().then((stored) => {
      if (!alive) return;
      const base = stored ?? emptyDraft;
      setDraft({
        ...base,
        step: reachableStep(base.step, business !== null),
        ...(business
          ? {
            primaryCategory: business.primaryCategory,
            otherCategories: business.secondaryCategories,
            workModel: business.workModel,
            businessName: business.name ?? base.businessName,
          }
          : {}),
      });
      setLoaded(true);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback(async (next: OnboardingDraft) => {
    setDraft(next);
    await saveDraft(next);
  }, []);

  if (!loaded) return <Screen><Brand /><Loading label="Retomando de onde você parou..." full /></Screen>;

  const index = STEPS.indexOf(draft.step);
  const productiveHours = parseNumber(draft.daysPerMonth) * parseNumber(draft.hoursPerDay);
  const appointments = Math.round(parseNumber(draft.appointmentsPerMonth));
  const hourlyRate = draft.hourlyMode === 'informar'
    ? parseCents(draft.hourlyRate) / 100
    : (productiveHours > 0 ? parseCents(draft.withdrawal) / 100 / productiveHours : 0);

  /**
   * A API guarda a retirada do mês, não o valor da hora; quem prefere dizer a
   * hora tem o mês reconstruído aqui, para o servidor receber o que ele espera.
   */
  const withdrawalCents = draft.hourlyMode === 'informar'
    ? Math.round(parseCents(draft.hourlyRate) * productiveHours)
    : parseCents(draft.withdrawal);

  const back = () => {
    setError(null);
    if (index > 0) void persist({ ...draft, step: STEPS[index - 1] });
  };

  /** Avança gravando o rascunho e, quando a etapa fecha um cadastro, o servidor. */
  const advance = (skipped: boolean) => {
    setError(null);
    const next: OnboardingDraft = {
      ...draft,
      step: STEPS[Math.min(index + 1, STEPS.length - 1)],
      skipped: skipped && !draft.skipped.includes(draft.step) ? [...draft.skipped, draft.step] : draft.skipped,
    };

    if (draft.step === 'trabalho') {
      void run(async () => {
        await app.saveOnboardingBusiness({
          businessName: next.businessName,
          primaryCategory: next.primaryCategory,
          secondaryCategories: next.otherCategories,
          workModel: next.workModel,
        });
        await persist(next);
      });
      return;
    }

    if (draft.step === 'objetivo') {
      if (productiveHours <= 0 || appointments <= 0) {
        setError('Confira os números da etapa anterior: horas e atendimentos precisam ser maiores que zero.');
        return;
      }
      void run(async () => {
        // O rateio por hora produtiva e o arredondamento neutro são o começo
        // seguro; os dois são editáveis depois, na tela de Custos.
        await app.saveSettings({
          desiredMonthlyWithdrawalCents: withdrawalCents,
          productiveHoursPerMonth: productiveHours,
          estimatedAppointmentsPerMonth: appointments,
          fixedCostAllocationMethod: 'PRODUCTIVE_HOUR',
          roundingStrategy: 'NONE',
          // Campo em branco é `null`, e não zero: "não disse" e "não quero
          // lucro" são respostas diferentes, e o servidor trata as duas assim.
          monthlyProfitGoalCents: draft.profitGoal.trim() ? parseCents(draft.profitGoal) : null,
        });
        await persist(next);
      });
      return;
    }

    void persist(next);
  };

  /** Primeiro resultado: um cálculo avulso salvo, sem criar serviço por conta própria. */
  const calculateFirst = () => {
    const duration = Math.round(parseNumber(service.duration));
    if (duration <= 0) {
      setError('Informe quantos minutos o atendimento leva.');
      return;
    }

    track('calculation_started', { origem: 'onboarding' });
    void run(async () => {
      const saved = await app.saveQuickCalculation({
        materialCost: parseCents(service.materialCost) / 100,
        durationMinutes: duration,
        hourlyRate: Math.round(hourlyRate * 100) / 100,
        // Ninguém cadastrou custo fixo ainda: entrar com zero é o único número
        // honesto, e a tela diz que o preço sobe quando eles forem cadastrados.
        monthlyFixedCosts: 0,
        monthlyProductiveHours: productiveHours,
        salesFeePercent: 0,
        desiredMarginPercent: parseNumber(service.margin),
      });
      setResult(saved);
      track('calculation_completed', { origem: 'onboarding' });
    });
  };

  /** Virar serviço da tabela é escolha explícita: o app não cadastra sozinho. */
  const keepAsService = () => {
    void run(async () => {
      await app.createService({
        name: service.name.trim() || service.category,
        category: slugOf(SERVICE_CATEGORIES, service.category),
        durationMinutes: Math.round(parseNumber(service.duration)),
        desiredMarginPercent: parseNumber(service.margin),
        currentPriceCents: result?.commercialPriceCents ?? null,
      });
      setSavedService(true);
    });
  };

  const finish = () => {
    void run(async () => {
      await forgetDraft();
      await app.finishOnboarding();
    });
  };

  const step = titles[draft.step];

  return (
    <Screen>
      <Brand />
      <ScreenHeader
        title={step.title}
        subtitle={step.subtitle}
        onBack={index > 0 ? back : undefined}
        right={<Badge label={`Etapa ${index + 1} de ${STEPS.length}`} tone="lilac" />}
      />
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`Etapa ${index + 1} de ${STEPS.length}`}
        accessibilityValue={{ min: 1, max: STEPS.length, now: index + 1 }}
        style={s.progress}
      >
        <ProgressBar value={((index + 1) / STEPS.length) * 100} />
      </View>

      {error && <Notice message={error} />}

      {draft.step === 'atuacao' && <>
        <Card>
          <ChoiceField
            label="Seu principal serviço"
            items={SEGMENTS.map((item) => item.label)}
            value={labelOf(SEGMENTS, draft.primaryCategory)}
            onChange={(label) => void persist({ ...draft, primaryCategory: slugOf(SEGMENTS, label) })}
          />
          <MultiChoice
            label="Outras categorias que você atende"
            items={SEGMENTS.filter((item) => item.slug !== draft.primaryCategory)}
            selected={draft.otherCategories}
            onChange={(slugs) => void persist({ ...draft, otherCategories: slugs })}
            hint="Ficam salvas na sua conta e acompanham você na troca de celular."
          />
          <Field
            label="Nome do seu negócio"
            value={draft.businessName}
            onChangeText={(value) => setDraft({ ...draft, businessName: value })}
            placeholder="Ex.: Studio da Ana"
            hint="opcional"
          />
        </Card>
      </>}

      {draft.step === 'trabalho' && <Card>
        <ChoiceField
          label="Como você atende"
          items={WORK_MODELS.map((item) => item.label)}
          value={labelOf(WORK_MODELS, draft.workModel)}
          onChange={(label) => void persist({ ...draft, workModel: slugOf(WORK_MODELS, label) })}
          hint="Quem atende em casa costuma ter custo fixo menor; quem aluga espaço, maior."
        />
      </Card>}

      {draft.step === 'capacidade' && <Card>
        <Row>
          <View style={ui.grow}>
            <Field
              label="Dias que você trabalha por mês"
              value={draft.daysPerMonth}
              onChangeText={(value) => setDraft({ ...draft, daysPerMonth: value })}
              numeric
            />
          </View>
          <View style={ui.grow}>
            <Field
              label="Horas de atendimento por dia"
              value={draft.hoursPerDay}
              onChangeText={(value) => setDraft({ ...draft, hoursPerDay: value })}
              numeric
            />
          </View>
        </Row>
        <Field
          label="Atendimentos por mês, mais ou menos"
          value={draft.appointmentsPerMonth}
          onChangeText={(value) => setDraft({ ...draft, appointmentsPerMonth: value })}
          numeric
          hint={`${productiveHours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h por mês`}
        />
        <Text style={s.hint}>
          Contamos só as horas de atendimento: compras, limpeza e redes sociais ficam de fora, senão a
          sua hora sai barata demais.
        </Text>
      </Card>}

      {draft.step === 'objetivo' && <Card>
        <ChoiceField
          label="Como definir o valor da sua hora"
          items={HOURLY_MODES}
          value={draft.hourlyMode === 'informar' ? HOURLY_MODES[1] : HOURLY_MODES[0]}
          onChange={(label) => void persist({ ...draft, hourlyMode: label === HOURLY_MODES[1] ? 'informar' : 'calcular' })}
        />
        {draft.hourlyMode === 'informar'
          ? <Field
            label="Quanto quero ganhar por hora"
            value={draft.hourlyRate}
            onChangeText={(value) => setDraft({ ...draft, hourlyRate: value })}
            prefix="R$"
            placeholder="0,00"
            numeric
            hint={`${formatMoney((parseCents(draft.hourlyRate) / 100) * productiveHours)} no mês`}
          />
          : <Field
            label="Quanto quero retirar por mês"
            value={draft.withdrawal}
            onChangeText={(value) => setDraft({ ...draft, withdrawal: value })}
            prefix="R$"
            numeric
            hint={`${formatMoney(hourlyRate)} / hora`}
          />}
        <Field
          label="Meta de lucro do negócio no mês"
          value={draft.profitGoal}
          onChangeText={(value) => setDraft({ ...draft, profitGoal: value })}
          prefix="R$"
          placeholder="opcional"
          numeric
        />
        <Text style={s.hint}>
          A retirada é o seu salário e já está no valor da hora. A meta de lucro é o que sobra para o
          negócio: ela fica salva na sua conta e vira o ponto de partida do simulador de meta.
        </Text>
      </Card>}

      {draft.step === 'resultado' && <>
        {draft.skipped.length > 0 && <Notice
          tone="lilac"
          message={`Você pulou ${draft.skipped.length === 1 ? 'uma etapa' : `${draft.skipped.length} etapas`}. Nada se perdeu: complete quando quiser em ${[...new Set(draft.skipped.map((item) => whereToFinish[item]))].join('; ')}.`}
        />}

        {!result && <Card>
          <Text style={s.intro}>
            Escolha um serviço que você faz muito. Com a sua hora a {formatMoney(hourlyRate)}, o preço sai
            na hora — e ele entra no seu histórico como o seu primeiro cálculo.
          </Text>
          <Field
            label="Nome do serviço"
            value={service.name}
            onChangeText={(value) => setService({ ...service, name: value })}
            placeholder="Ex.: Alongamento em gel"
            hint="opcional"
          />
          <ChoiceField
            label="Categoria"
            items={SERVICE_CATEGORIES.map((item) => item.label)}
            value={service.category}
            onChange={(value) => setService({ ...service, category: value })}
          />
          <Row>
            <View style={ui.grow}>
              <Field
                label="Duração (minutos)"
                value={service.duration}
                onChangeText={(value) => setService({ ...service, duration: value })}
                numeric
              />
            </View>
            <View style={ui.grow}>
              <Field
                label="Margem desejada (%)"
                value={service.margin}
                onChangeText={(value) => setService({ ...service, margin: value })}
                numeric
              />
            </View>
          </Row>
          <Field
            label="Custo dos materiais"
            value={service.materialCost}
            onChangeText={(value) => setService({ ...service, materialCost: value })}
            prefix="R$"
            placeholder="0,00"
            numeric
            hint="o que sai do estoque por atendimento"
          />
          <Text style={s.hint}>
            Ainda sem custos fixos cadastrados, este preço considera só o seu tempo e os materiais. Ao
            cadastrar aluguel, energia e internet em Custos, ele sobe — e fica mais real.
          </Text>
        </Card>}

        {busy && !result && <Loading label="Calculando o seu primeiro preço..." />}

        {result && <View accessibilityLiveRegion="polite">
          <HeroCard
            label="Seu primeiro preço"
            value={formatCents(result.commercialPriceCents)}
            caption={service.name.trim() || service.category}
            hint={`Preço mínimo, sem lucro: ${formatCents(result.minimumPriceCents)}`}
          />
          <Section title="Como chegamos nesse valor" first />
          <Card>
            <Line label="Materiais" value={formatCents(result.materialCostCents)} />
            <Line label="Mão de obra" value={formatCents(result.laborCostCents)} />
            <Line label="Custos fixos rateados" value={formatCents(result.allocatedFixedCostCents)} />
            <Line label="Seu custo total" value={formatCents(result.totalBaseCostCents)} strong />
          </Card>
          <Row>
            <StatCard
              icon="trend"
              label="Lucro por atendimento"
              value={formatCents(result.expectedProfitCents)}
              caption={`Margem de ${result.expectedMarginPercent}%`}
            />
            <StatCard
              icon="clock"
              label="Sua hora"
              value={formatMoney(hourlyRate)}
              caption={`${productiveHours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h por mês`}
              tone="lilac"
            />
          </Row>
          <Text style={s.hint}>Estimativa calculada com os dados que você informou.</Text>
          {savedService && <Notice tone="success" message="Salvo na sua tabela. Dá para editar a composição de materiais em Serviços." />}
        </View>}
      </>}

      {draft.step === 'resultado'
        ? <>
          {!result && <Button label={busy ? 'Calculando...' : 'Ver meu primeiro preço'} icon="arrow" onPress={busy ? undefined : calculateFirst} />}
          {result && !savedService && <Button label={busy ? 'Salvando...' : 'Salvar como meu primeiro serviço'} icon="check" onPress={busy ? undefined : keepAsService} />}
          <Button label={busy ? 'Abrindo...' : result ? 'Ir para o meu painel' : 'Pular e ir para o meu painel'} icon="arrow" secondary={!result || !savedService} onPress={busy ? undefined : finish} />
        </>
        : <>
          <Button label={busy ? 'Salvando...' : 'Continuar'} icon="arrow" onPress={busy ? undefined : () => advance(false)} />
          {/* Pular é um direito da usuária, não um atalho escondido. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pular esta etapa"
            onPress={busy ? undefined : () => advance(true)}
            style={({ pressed }) => [s.skip, pressed && ui.pressed]}
          >
            <Text style={ui.link}>Pular esta etapa</Text>
          </Pressable>
          <Text style={s.hint}>Dá para completar depois em {whereToFinish[draft.step]}.</Text>
        </>}

      {/* Saída de emergência: ninguém fica preso no onboarding por engano. */}
      <Pressable accessibilityRole="button" onPress={() => void app.signOut()} style={({ pressed }) => [s.skip, pressed && ui.pressed]}>
        <Text style={s.leave}>Sair da conta</Text>
      </Pressable>
    </Screen>
  );
}

/**
 * Etapa em que o rascunho pode de fato ser retomado.
 *
 * O rascunho vive no aparelho e sobrevive a uma troca de conta; sem esta
 * checagem, uma conta nova herdaria a etapa 5 de outra e pediria um cálculo
 * antes de existir negócio para calcular.
 */
function reachableStep(step: Step, hasBusiness: boolean): Step {
  if (hasBusiness) return step;
  return STEPS.indexOf(step) > STEPS.indexOf('trabalho') ? 'trabalho' : step;
}

/**
 * Escolha de várias opções, com o mesmo rótulo associado que o `ChoiceField`
 * dá a uma escolha única — exigência do item C-06.
 */
function MultiChoice({ label, items, selected, onChange, hint }: {
  label: string;
  items: { slug: string; label: string }[];
  selected: string[];
  onChange: (slugs: string[]) => void;
  hint?: string;
}) {
  return <View accessibilityLabel={label}>
    <Text style={ui.groupLabel}>{label}</Text>
    <View style={ui.chips}>{items.map((item) => {
      const active = selected.includes(item.slug);
      return <Pressable
        key={item.slug}
        accessibilityRole="checkbox"
        accessibilityLabel={item.label}
        accessibilityState={{ checked: active }}
        onPress={() => onChange(active ? selected.filter((slug) => slug !== item.slug) : [...selected, item.slug])}
        style={({ pressed }) => [ui.chip, active && ui.chipActive, pressed && ui.pressed]}
      >
        <Text style={[ui.chipText, active && ui.chipTextActive]}>{item.label}</Text>
      </Pressable>;
    })}</View>
    {hint && <Text style={s.hint}>{hint}</Text>}
  </View>;
}


const s = StyleSheet.create({
  progress: { marginBottom: 20 },
  intro: { color: colors.ink3, fontSize: 12, lineHeight: 18 },
  hint: { color: colors.faded, fontSize: 11, lineHeight: 17, marginBottom: 10 },
  skip: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  leave: { color: colors.muted, fontSize: 12 },
});
