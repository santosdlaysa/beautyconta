import type { Request, Response } from "express";
import type { Dependencies } from "../../../application/ports/dependencies";
import { BusinessAccess } from "../../../application/services/business-access";
import {
  GetCalculation,
  ListCalculations,
} from "../../../application/use-cases/calculations";
import { CalculateServicePrice } from "../../../application/use-cases/calculate-service-price";
import { SaveCalculation } from "../../../application/use-cases/price-service";
import { serializeCalculation } from "../mappers/serializers";
import { userIdOf } from "../middleware/identity";
import { parse } from "../validators/parse";
import { businessParamSchema, idParamSchema, listQuerySchema } from "../validators/schemas";
import { calculateSchema } from "./PricingController";

export class CalculationController {
  private readonly access: BusinessAccess;

  constructor(private readonly deps: Dependencies) {
    this.access = new BusinessAccess(deps.businesses, deps.subscriptions);
  }

  /**
   * Histórico do negócio.
   *
   * `limitedByPlan` avisa que existem cálculos além da janela do plano
   * gratuito. Eles continuam gravados — o item F-01 proíbe apagar dado ao
   * atingir limite — e voltam a aparecer com a assinatura.
   */
  list = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const query = parse(listQuerySchema, req.query);

    const { items, total, limitedByPlan } = await new ListCalculations(
      this.access,
      this.deps.calculations,
    ).execute(userIdOf(req), businessId, {
      ...(query.serviceId !== undefined ? { serviceId: query.serviceId } : {}),
    });

    res.json({ items: items.map(serializeCalculation), total, limitedByPlan });
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);

    const calculation = await new GetCalculation(this.access, this.deps.calculations).execute(
      userIdOf(req),
      businessId,
      id,
    );
    res.json(serializeCalculation(calculation));
  };

  /**
   * Cálculo avulso salvo: a mesma entrada da calculadora pública, gravada no
   * histórico sem estar presa a um serviço do catálogo. É o que permite migrar
   * para a conta o cálculo feito antes do cadastro, no item D-03.
   */
  create = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const input = parse(calculateSchema, req.body, "Confira os dados informados para calcular o preço.");

    const result = new CalculateServicePrice().execute(input);
    const saved = await new SaveCalculation(this.access, this.deps.calculations).execute(
      userIdOf(req),
      businessId,
      { serviceId: null, input, result },
    );

    res.status(201).json({ result, saved: serializeCalculation(saved) });
  };
}
