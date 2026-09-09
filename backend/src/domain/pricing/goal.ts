import { calculateGoalPrice } from "./calculate-price";
import { DomainError } from "../shared/domain-error";

export type GoalInput = {
  totalCost: number;
  monthlyProfitGoal: number;
  monthlyAppointments: number;
  salesFeePercent?: number;
  /** Preço praticado hoje, para responder quantos atendimentos a meta exige. */
  currentPrice?: number;
};

export type GoalResult = {
  calculationVersion: 1;
  profitPerAppointment: number;
  projectedPrice: number;
  /**
   * Quantos atendimentos seriam necessários no preço atual. `null` quando o
   * preço atual não cobre o custo: nesse caso nenhum volume alcança a meta, e
   * dizer um número seria mentira aritmética.
   */
  appointmentsNeededAtCurrentPrice: number | null;
  /** A saída é projeção, nunca garantia — exigência do item A-04. */
  disclaimer: string;
};

const DISCLAIMER =
  "Projeção baseada nos dados informados. Não é garantia de faturamento nem de lucro.";

const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Simulador de meta da seção 10 do documento 03.
 *
 * A meta distingue retirada da profissional de lucro do negócio: o valor/hora
 * já remunera o trabalho, e o que se simula aqui é o lucro que sobra além dele.
 */
export function simulateGoal(input: GoalInput): GoalResult {
  const base = calculateGoalPrice(input);

  let appointmentsNeededAtCurrentPrice: number | null = null;

  if (input.currentPrice !== undefined) {
    if (!Number.isFinite(input.currentPrice) || input.currentPrice < 0) {
      throw new DomainError("Confira o preço atual informado.", "currentPrice");
    }
    const fee = (input.salesFeePercent ?? 0) / 100;
    const profitPerAppointment = input.currentPrice - input.totalCost - input.currentPrice * fee;

    appointmentsNeededAtCurrentPrice =
      profitPerAppointment > 0
        ? Math.ceil(input.monthlyProfitGoal / profitPerAppointment)
        : null;
  }

  return {
    calculationVersion: 1,
    profitPerAppointment: cents(base.profitPerAppointment),
    projectedPrice: cents(base.projectedPrice),
    appointmentsNeededAtCurrentPrice,
    disclaimer: DISCLAIMER,
  };
}
