import { colors } from '../theme';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { track } from '../lib/analytics';
import { simulateGoal, type GoalResult } from '../lib/resources';
import { readMonthlyProfitGoal } from '../lib/onboarding';
import { formatMoney, parseCents, parseNumber, useSubmit } from '../lib/useSubmit';
import { Button, Card, Field, Loading, Notice, Row, Section, StatCard } from './ui';

/**
 * Simulador de meta (item A-04, seção 10 do documento 03).
 *
 * Vem depois do preço porque é ali que a pergunta nasce: a usuária acabou de
 * ver quanto custa e quanto pode cobrar, e a dúvida seguinte é sempre "isso dá
 * para viver?". Com o custo do serviço já na tela, ela só precisa dizer quanto
 * quer de lucro no mês e quantos atendimentos espera fazer.
 *
 * O que aparece é **projeção, nunca garantia**: o texto de ressalva vem pronto
 * do servidor e é exibido como está, sem reescrever nem resumir. E quando o
 * preço atual não cobre o custo, a API devolve `null` em vez de um número de
 * atendimentos — porque nesse preço nenhum volume alcança a meta, e inventar um
 * número seria mentira aritmética.
 */

type Props = {
  /** Custo total do atendimento, em reais, como o motor devolve. */
  totalCost: number;
  /** Taxa sobre a venda em pontos percentuais: entra no lucro por atendimento. */
  feePercent: number;
  /** Preço praticado hoje, quando existe: responde "quantos atendimentos?". */
  currentPrice?: number | null;
  /** Atendimentos por mês da configuração do negócio, quando já configurada. */
  monthlyAppointments?: number | null;
};

const toInput = (value: number) => value.toFixed(2).replace('.', ',');

export function GoalSimulator({ totalCost, feePercent, currentPrice, monthlyAppointments }: Props) {
  const { busy, error, setError, run } = useSubmit();
  const [goal, setGoal] = useState('');
  const [appointments, setAppointments] = useState(String(monthlyAppointments ?? 60));
  const [price, setPrice] = useState(currentPrice ? toInput(currentPrice) : '');
  const [result, setResult] = useState<GoalResult | null>(null);

  // A meta de lucro que a usuária informou no onboarding não tem campo na API e
  // ficou no aparelho; aqui ela vira o valor inicial em vez de ser esquecida.
  useEffect(() => {
    let alive = true;
    void readMonthlyProfitGoal().then((cents) => {
      if (alive && cents !== null) setGoal(toInput(cents / 100));
    });
    return () => { alive = false; };
  }, []);

  const simulate = () => {
    const monthlyProfitGoal = parseCents(goal) / 100;
    const monthly = Math.round(parseNumber(appointments));

    if (monthlyProfitGoal <= 0) {
      setError('Diga quanto você quer de lucro no mês para simular.');
      return;
    }
    if (monthly <= 0) {
      setError('Informe quantos atendimentos você espera fazer no mês.');
      return;
    }

    const informed = price.trim() ? parseCents(price) / 100 : undefined;

    void run(async () => {
      const projection = await simulateGoal({
        totalCost,
        monthlyProfitGoal,
        monthlyAppointments: monthly,
        salesFeePercent: feePercent,
        ...(informed !== undefined ? { currentPrice: informed } : {}),
      });
      setResult(projection);
      track('price_simulated', { origem: 'meta' });
    });
  };

  return (
    <>
      <Section title="Quanto preciso para bater minha meta" />
      <Card>
        <Text style={s.intro}>
          Informe o lucro que você quer no mês — além da sua retirada, que já está no valor da hora —
          e quantos atendimentos espera fazer. O cálculo devolve o preço que projeta essa meta.
        </Text>
        <Field
          label="Lucro que quero no mês"
          value={goal}
          onChangeText={setGoal}
          prefix="R$"
          placeholder="0,00"
          numeric
        />
        <Field
          label="Atendimentos que espero no mês"
          value={appointments}
          onChangeText={setAppointments}
          numeric
          hint="mais ou menos"
        />
        <Field
          label="Preço que você cobra hoje"
          value={price}
          onChangeText={setPrice}
          prefix="R$"
          placeholder="opcional"
          numeric
        />
        <Text style={s.hint}>Simular não altera nada do que está salvo.</Text>
      </Card>

      {error && <Notice message={error} />}
      <Button label={busy ? 'Simulando...' : 'Simular minha meta'} icon="trend" onPress={busy ? undefined : simulate} />

      {busy && !result && <Loading label="Projetando a sua meta..." />}

      {result && <View accessibilityLiveRegion="polite">
        <Row>
          <StatCard
            icon="trend"
            label="Lucro por atendimento"
            value={formatMoney(result.profitPerAppointment)}
            caption="Necessário para a meta"
          />
          <StatCard
            icon="tag"
            label="Preço projetado"
            value={formatMoney(result.projectedPrice)}
            caption="Neste serviço"
            tone="lilac"
          />
        </Row>

        {price.trim() !== '' && <Card>
          {result.appointmentsNeededAtCurrentPrice === null
            ? <Notice
              message="No preço que você cobra hoje, cada atendimento não cobre o próprio custo: nenhuma quantidade de clientes alcança essa meta. O caminho é o preço, não o volume."
            />
            : <Text style={s.answer}>
              No preço que você cobra hoje, seriam{' '}
              <Text style={s.answerStrong}>{result.appointmentsNeededAtCurrentPrice}</Text>{' '}
              {result.appointmentsNeededAtCurrentPrice === 1 ? 'atendimento' : 'atendimentos'} no mês para chegar
              a essa meta.
            </Text>}
        </Card>}

        {/* A ressalva vem do servidor e é exibida inteira: a saída é projeção. */}
        <Notice tone="lilac" message={result.disclaimer} />
      </View>}
    </>
  );
}

const s = StyleSheet.create({
  intro: { color: colors.ink3, fontSize: 12, lineHeight: 18 },
  hint: { color: colors.faded, fontSize: 11, lineHeight: 17 },
  answer: { color: colors.ink2, fontSize: 13, lineHeight: 20 },
  answerStrong: { color: colors.ink, fontWeight: '700' },
});
