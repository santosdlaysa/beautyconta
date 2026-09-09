import { colors } from '../theme';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { track } from '../lib/analytics';
import type { PricingResult } from '../lib/resources';
import { formatMoney, parseNumber } from '../lib/useSubmit';
import { Button, Card, Field, Notice, Section, ui } from './ui';

/**
 * Escolha do preço final.
 *
 * O motor devolve o preço que fecha a margem pedida, mas quem cobra é a
 * usuária: ela arredonda para um número que se fala em voz alta, acompanha o
 * que a região pratica ou decide ganhar menos num serviço de entrada. O que o
 * aplicativo não deixa passar em silêncio é preço abaixo do custo — aí o aviso
 * aparece, com o tamanho do prejuízo por atendimento.
 */

type Option = { label: string; price: number; hint: string };

const ceilTo = (value: number, step: number) => Math.ceil(value / step) * step;
const endingNinety = (value: number) => Math.ceil(value - 0.9) + 0.9;
const round = (value: number) => Math.round(value * 100) / 100;

export function PriceChooser({ result, feePercent, currentPrice, busy, onUse, label = 'Usar este preço' }: {
  result: PricingResult;
  /** Taxa sobre a venda, em pontos percentuais: entra no lucro do preço escolhido. */
  feePercent: number;
  /** Preço praticado hoje, quando existe: começa selecionado. */
  currentPrice?: number | null;
  busy?: boolean;
  onUse?: (price: number) => void;
  label?: string;
}) {
  const options = useMemo<Option[]>(() => {
    const suggested = result.commercialPrice || result.suggestedPrice;
    const candidates: Option[] = [
      { label: formatMoney(suggested), price: round(suggested), hint: 'Sugerido' },
      { label: formatMoney(ceilTo(suggested, 5)), price: round(ceilTo(suggested, 5)), hint: 'Múltiplo de 5' },
      { label: formatMoney(ceilTo(suggested, 10)), price: round(ceilTo(suggested, 10)), hint: 'Múltiplo de 10' },
      { label: formatMoney(endingNinety(suggested)), price: round(endingNinety(suggested)), hint: 'Final 90' },
    ];

    // Arredondamentos diferentes caem no mesmo valor com frequência; repetir a
    // mesma quantia em dois botões só confunde.
    return candidates.filter(
      (option, index) => candidates.findIndex((other) => other.price === option.price) === index,
    );
  }, [result.commercialPrice, result.suggestedPrice]);

  const [chosen, setChosen] = useState<number>(currentPrice ?? options[0].price);
  const [custom, setCustom] = useState('');
  const [editing, setEditing] = useState(false);

  const price = editing ? parseNumber(custom) : chosen;
  const fee = price * (feePercent / 100);
  const profit = price - result.totalCost - fee;
  const margin = price > 0 ? (profit / price) * 100 : 0;
  const belowCost = price > 0 && price < result.minimumPrice;

  return (
    <>
      <Section title="Quanto você vai cobrar" />
      <Card>
        <Text style={s.intro}>
          O cálculo sugere {formatMoney(result.commercialPrice || result.suggestedPrice)}. Você decide o valor final.
        </Text>

        <View style={s.options}>
          {options.map((option) => {
            const active = !editing && option.price === price;
            return (
              <Pressable
                key={option.price}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${option.hint}: ${option.label}`}
                // Experimentar outro preço é simular: só o motivo viaja no
                // evento, nunca o preço experimentado.
                onPress={() => { setEditing(false); setChosen(option.price); track('price_simulated', { origem: 'arredondamento' }); }}
                style={({ pressed }) => [s.option, active && s.optionActive, pressed && ui.pressed]}
              >
                <Text style={[s.optionPrice, active && s.optionTextActive]}>{option.label}</Text>
                <Text style={[s.optionHint, active && s.optionTextActive]}>{option.hint}</Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: editing }}
            accessibilityLabel="Digitar outro preço"
            onPress={() => { setEditing(true); if (!custom) setCustom(String(chosen).replace('.', ',')); track('price_simulated', { origem: 'digitado' }); }}
            style={({ pressed }) => [s.option, editing && s.optionActive, pressed && ui.pressed]}
          >
            <Text style={[s.optionPrice, editing && s.optionTextActive]}>Outro</Text>
            <Text style={[s.optionHint, editing && s.optionTextActive]}>Eu escolho</Text>
          </Pressable>
        </View>

        {editing && <Field label="Preço que vou cobrar" value={custom} onChangeText={setCustom} prefix="R$" numeric />}

        <View style={s.summary}>
          <View style={ui.grow}>
            <Text style={s.summaryLabel}>Cobrando {formatMoney(price)}</Text>
            <Text style={[s.summaryValue, belowCost && s.loss]}>
              {profit >= 0 ? 'Lucro de ' : 'Prejuízo de '}{formatMoney(Math.abs(profit))} por atendimento
            </Text>
            <Text style={s.summaryHint}>
              Margem de {margin.toFixed(1)}% · custo de {formatMoney(result.totalCost)}
              {feePercent > 0 ? ` · taxa de ${formatMoney(fee)}` : ''}
            </Text>
          </View>
        </View>

        {belowCost && (
          <Notice
            tone="warning"
            message={`Esse preço não cobre seus custos. O mínimo para não ter prejuízo é ${formatMoney(result.minimumPrice)}.`}
          />
        )}
      </Card>

      {onUse && (
        <Button
          label={busy ? 'Salvando...' : label}
          icon="check"
          onPress={busy || price <= 0 ? undefined : () => onUse(round(price))}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  intro: { color: colors.ink3, fontSize: 12, lineHeight: 18 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minWidth: 96, flexGrow: 1, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, paddingVertical: 11, paddingHorizontal: 13, gap: 3 },
  optionActive: { backgroundColor: colors.pink, borderColor: colors.pink },
  optionPrice: { color: colors.ink, fontSize: 14, fontWeight: '600', letterSpacing: -0.3 },
  optionHint: { color: colors.faded, fontSize: 10 },
  optionTextActive: { color: colors.white },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.softLilac, borderRadius: 18, padding: 14 },
  summaryLabel: { color: colors.muted, fontSize: 11 },
  summaryValue: { color: colors.ink, fontSize: 15, fontWeight: '600', letterSpacing: -0.3, marginTop: 4 },
  summaryHint: { color: colors.ink3, fontSize: 10, lineHeight: 16, marginTop: 5 },
  loss: { color: colors.danger },
});
