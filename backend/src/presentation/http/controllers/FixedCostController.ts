import type { Request, Response } from "express";
import type { Dependencies } from "../../../application/ports/dependencies";
import { BusinessAccess } from "../../../application/services/business-access";
import {
  DeleteFixedCost,
  GetFixedCost,
  ListFixedCosts,
  RegisterFixedCost,
  UpdateFixedCost,
} from "../../../application/use-cases/fixed-costs";
import { serializeFixedCost } from "../mappers/serializers";
import { userIdOf } from "../middleware/identity";
import { parse } from "../validators/parse";
import {
  businessParamSchema,
  createFixedCostSchema,
  idParamSchema,
  listQuerySchema,
  updateFixedCostSchema,
} from "../validators/schemas";

export class FixedCostController {
  private readonly access: BusinessAccess;

  constructor(private readonly deps: Dependencies) {
    this.access = new BusinessAccess(deps.businesses, deps.subscriptions);
  }

  create = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const input = parse(createFixedCostSchema, req.body);

    const fixedCost = await new RegisterFixedCost(this.access, this.deps.fixedCosts).execute(
      userIdOf(req),
      businessId,
      input,
    );
    res.status(201).json(serializeFixedCost(fixedCost));
  };

  /** A resposta traz o total mensal ativo, que é o `CF` das fórmulas. */
  list = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const query = parse(listQuerySchema, req.query);

    const { items, monthlyTotalCents } = await new ListFixedCosts(
      this.access,
      this.deps.fixedCosts,
    ).execute(userIdOf(req), businessId, { includeInactive: query.includeInactive === "true" });

    res.json({ items: items.map(serializeFixedCost), monthlyTotalCents });
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);

    const fixedCost = await new GetFixedCost(this.access, this.deps.fixedCosts).execute(
      userIdOf(req),
      businessId,
      id,
    );
    res.json(serializeFixedCost(fixedCost));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);
    const input = parse(updateFixedCostSchema, req.body);

    const fixedCost = await new UpdateFixedCost(this.access, this.deps.fixedCosts).execute(
      userIdOf(req),
      businessId,
      id,
      input,
    );
    res.json(serializeFixedCost(fixedCost));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);

    await new DeleteFixedCost(this.access, this.deps.fixedCosts).execute(
      userIdOf(req),
      businessId,
      id,
    );
    res.status(204).end();
  };
}
