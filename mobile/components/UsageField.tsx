import { colors } from '../theme';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatMoney, parseNumber } from '../lib/useSubmit';
import { ChoiceField, Field } from './ui';

/**
 * Quanto de um material sai por atendimento.
 *
 * A pergunta direta — "quantas gramas de gel você usa?" — quase ninguém sabe
 * responder, e chutar aqui contamina o preço inteiro. As outras duas formas de
 * perguntar a mesma coisa são as que a profissional responde de cabeça:
 *
 * - **rendimento**: "esse pote rende quantas clientes?" — quem compra e usa
 *   sabe, porque acompanha o pote acabar;
 * - **duração**: "quanto tempo dura?" — cruzado com os atendimentos do mês, dá
 *   o mesmo número.
 *
 * As três terminam no mesmo lugar: a quantidade por atendimento que o motor
 * usa. O que muda é o caminho até ela, e o custo por atendimento aparece o
 * tempo todo — é ele que a usuária consegue julgar como certo ou absurdo.
 */

type Mode = 'Rende' | 'Dura' | 'Quantidade';
const MODES: Mode[] = ['Rende', 'Dura', 'Quantidade'];

export function UsageField({ unitLabel, packageQuantity, unitCostCents, value, onChange, appointmentsPerMonth }: {
  /** Unidade da compra: grama, mililitro, unidade. */
  unitLabel: string;
  /** Quanto vem na embalagem comprada. */
  packageQuantity: number;
  /** Custo de uma unidade da embalagem, já com a perda. */
  unitCostCents: number;
  /** Quantidade por atendimento — o que o cálculo consome. */
  value: number;
  onChange: (quantityUsed: number) => void;
  /** Atendimentos por mês da usuária; sustenta o modo "dura". */
  appointmentsPerMonth?: number;
}) {
  const [mode, setMode] = useState<Mode>('Rende');
  const [yieldText, setYieldText] = useState(() => (value > 0 && packageQuantity > 0 ? String(Math.round(packageQuantity / value)) : ''));
  const [monthsText, setMonthsText] = useState('');

  const applyYield = (text: string) => {
    setYieldText(text);
    const uses = parseNumber(text);
    if (uses > 0 && packageQuantity > 0) onChange(packageQuantity / uses);
  };

  const applyMonths = (text: string) => {
    setMonthsText(text);
    const months = parseNumber(text);
    const perMonth = appointmentsPerMonth ?? 0;
    // Sem saber quantos atendimentos ela faz por mês, "dura dois meses" não
    // vira número nenhum: o campo fica visível, mas não altera a quantidade.
    if (months > 0 && perMonth > 0 && packageQuantity > 0) onChange(packageQuantity / (months * perMonth));
  };

  const costPerUse = unitCostCents * value;
  const uses = value > 0 && packageQuantity > 0 ? packageQuantity / value : 0;

  return (
    <View style={s.wrap}>
      <ChoiceField label="Como você prefere informar o consumo" items={MODES} value={mode} onChange={item => setMode(item as Mode)} />

      {mode === 'Rende' && (
        <Field
          label="Uma embalagem rende quantos atendimentos?"
          value={yieldText}
          onChangeText={applyYield}
          numeric
          placeholder="Ex.: 15"
          hint="chute redondo serve"
        />
      )}

      {mode === 'Dura' && (
        <>
          <Field
            label="Quantos meses dura uma embalagem?"
            value={monthsText}
            onChangeText={applyMonths}
            numeric
            placeholder="Ex.: 2"
            hint={appointmentsPerMonth ? `${appointmentsPerMonth} atend./mês` : undefined}
          />
          {!appointmentsPerMonth && (
            <Text style={s.warn}>
              Informe quantos atendimentos você faz por mês em Custos para esta conta funcionar.
            </Text>
          )}
        </>
      )}

      {mode === 'Quantidade' && (
        <Field
          label={`Quanto usa por atendimento (${unitLabel})`}
          value={value ? String(Number(value.toFixed(3))) : ''}
          onChangeText={text => onChange(parseNumber(text))}
          numeric
          placeholder="Ex.: 2"
        />
      )}

      <View style={s.result}>
        <Text style={s.resultValue}>{costPerUse > 0 ? `${formatMoney(costPerUse / 100)} por atendimento` : 'Custo por atendimento aparece aqui'}</Text>
        {uses > 0 && (
          <Text style={s.resultHint}>
            {`${Number(value.toFixed(3))} ${unitLabel} de cada vez · a embalagem rende ${Math.round(uses)} atendimentos`}
          </Text>
        )}
      </View>

      <Text style={s.tip}>
        Na dúvida, olhe para o custo por atendimento: se parecer alto ou baixo demais para o que você usa, ajuste o
        número até fazer sentido. Dá para acertar depois, com o pote acabando.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 11 },
  warn: { color: colors.warning, fontSize: 11, lineHeight: 17 },
  result: { backgroundColor: colors.softLilac, borderRadius: 16, padding: 13, gap: 4 },
  resultValue: { color: colors.ink, fontSize: 14, fontWeight: '600', letterSpacing: -0.3 },
  resultHint: { color: colors.ink3, fontSize: 11, lineHeight: 17 },
  tip: { color: colors.faded, fontSize: 11, lineHeight: 17 },
});

/** Reaproveitado pela linha da composição, que mostra o mesmo número. */
export const usageSummary = (unitLabel: string, quantityUsed: number, unitCostCents: number): string =>
  `${Number(quantityUsed.toFixed(3))} ${unitLabel} · ${formatMoney((unitCostCents * quantityUsed) / 100)} por atendimento`;
