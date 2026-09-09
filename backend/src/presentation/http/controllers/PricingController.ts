import type { Request, Response } from "express";
import { z } from "zod";
import { CalculateServicePrice } from "../../../application/use-cases/calculate-service-price";
import { SimulateGoal } from "../../../application/use-cases/simulate-goal";
import { parse } from "../validators/parse";

/**
 * Validação de borda. Limites numéricos aqui são apenas o filtro grosseiro
 * contra lixo e estouro; as faixas de negócio da seção 11 do documento 03 são
 * verificadas no domínio, que é quem sabe explicar o motivo à usuária.
 */
export const calculateSchema = z.object({
  materialCost: z.number().min(0).max(100_000_000).optional(),
  materials: z.array(z.object({
    purchasePrice: z.number().min(0).max(100_000_000), purchasedQuantity: z.number().positive(),
    usedQuantity: z.number().min(0), lossPercent: z.number().min(0).max(100).optional(),
  })).max(100).optional(),
  durationMinutes: z.number().int().min(1).max(1440),
  hourlyRate: z.number().min(0).max(100_000_000).optional(),
  desiredMonthlyWithdrawal: z.number().min(0).max(100_000_000).optional(),
  productiveDaysPerMonth: z.number().min(1).max(31).optional(),
  productiveHoursPerDay: z.number().positive().max(24).optional(),
  monthlyFixedCosts: z.number().min(0).max(100_000_000),
  monthlyProductiveHours: z.number().positive().max(744).optional(),
  monthlyAppointments: z.number().int().positive().max(100_000).optional(),
  allocationMethod: z.enum(["productive_hour", "appointment"]).optional(),
  otherDirectCosts: z.number().min(0).max(100_000_000).optional(),
  salesFeePercent: z.number().min(0).max(99).default(0),
  desiredMarginPercent: z.number().min(0).max(95),
  currentPrice: z.number().min(0).max(100_000_000).optional(),
  roundingStrategy: z.enum(["none", "1", "5", "10", "90"]).optional(),
});

/** Entrada do simulador de meta da seção 10 do documento 03. */
export const goalSchema = z.object({
  totalCost: z.number().min(0).max(100_000_000),
  monthlyProfitGoal: z.number().min(0).max(100_000_000),
  monthlyAppointments: z.number().int().positive().max(100_000),
  salesFeePercent: z.number().min(0).max(99).optional(),
  currentPrice: z.number().min(0).max(100_000_000).optional(),
});

const INVALID_INPUT = "Confira os dados informados para calcular o preço.";

/**
 * Calculadora pública.
 *
 * Não exige cadastro, conforme a jornada do documento 02, e responde em reais —
 * a exceção deliberada à convenção de centavos do resto da API, porque é o
 * formato que o aplicativo Expo já consome.
 */
export class PricingController {
  constructor(
    private readonly calculateServicePrice = new CalculateServicePrice(),
    private readonly simulateGoal = new SimulateGoal(),
  ) {}

  calculate = (req: Request, res: Response): void => {
    const input = parse(calculateSchema, req.body, INVALID_INPUT);
    res.json(this.calculateServicePrice.execute(input));
  };

  goal = (req: Request, res: Response): void => {
    const input = parse(goalSchema, req.body, INVALID_INPUT);
    res.json(this.simulateGoal.execute(input));
  };
}
