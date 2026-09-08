import { calculatePrice, type PricingInput, type PricingResult } from "../../domain/pricing/calculate-price";

/**
 * Calcula o preço recomendado de um serviço.
 *
 * Este caso de uso não persiste nada: atende tanto a calculadora pública, que
 * não exige cadastro, quanto o cálculo autenticado antes de salvar. A
 * persistência é responsabilidade de `SaveCalculation`.
 */
export class CalculateServicePrice {
  execute(input: PricingInput): PricingResult {
    return calculatePrice(input);
  }
}
