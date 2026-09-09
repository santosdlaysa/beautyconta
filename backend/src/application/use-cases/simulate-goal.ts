import { simulateGoal, type GoalInput, type GoalResult } from "../../domain/pricing/goal";

/**
 * Simulador de meta, item A-04.
 *
 * Como a calculadora, não persiste nada e não exige cadastro: é uma projeção
 * sobre números que a usuária acabou de informar.
 */
export class SimulateGoal {
  execute(input: GoalInput): GoalResult {
    return simulateGoal(input);
  }
}
