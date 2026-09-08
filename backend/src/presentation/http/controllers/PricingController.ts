import type { Request, Response } from "express";
import { z } from "zod";
import { CalculateServicePrice } from "../../../application/use-cases/calculate-service-price";
import { DomainError } from "../../../domain/shared";

/**
 * Validação de borda. Limites numéricos aqui são apenas o filtro grosseiro
 * contra lixo e estouro; as faixas de negócio da seção 11 do documento 03 são
 * verificadas no domínio, que é quem sabe explicar o motivo à usuária.
 */
const calculateSchema = z.object({
  materialCost: z.number().min(0).max(100_000_000),
  durationMinutes: z.number().int().min(1).max(1440),
  hourlyRate: z.number().min(0).max(100_000_000),
  monthlyFixedCosts: z.number().min(0).max(100_000_000),
  monthlyProductiveHours: z.number().min(0).max(1000),
  salesFeePercent: z.number().min(0).max(99).default(0),
  desiredMarginPercent: z.number().min(0).max(95),
  currentPrice: z.number().min(0).max(100_000_000).optional(),
});

export class PricingController {
  constructor(private readonly calculateServicePrice = new CalculateServicePrice()) {}

  calculate = (req: Request, res: Response): void => {
    const parsed = calculateSchema.safeParse(req.body);

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      res.status(422).json({
        error: "invalid_input",
        message: "Confira os dados informados para calcular o preço.",
        field: first?.path.join("."),
      });
      return;
    }

    try {
      res.json(this.calculateServicePrice.execute(parsed.data));
    } catch (error) {
      if (error instanceof DomainError) {
        res.status(422).json({ error: "domain_error", message: error.message, field: error.field });
        return;
      }
      throw error;
    }
  };
}
