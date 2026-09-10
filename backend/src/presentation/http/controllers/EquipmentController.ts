import type { Request, Response } from "express";
import type { Dependencies } from "../../../application/ports/dependencies";
import { BusinessAccess } from "../../../application/services/business-access";
import {
  DeleteEquipment,
  GetEquipment,
  ListEquipment,
  RegisterEquipment,
  UpdateEquipment,
} from "../../../application/use-cases/equipment";
import { serializeEquipment } from "../mappers/serializers";
import { userIdOf } from "../middleware/identity";
import { parse } from "../validators/parse";
import {
  businessParamSchema,
  createEquipmentSchema,
  idParamSchema,
  listQuerySchema,
  toDate,
  updateEquipmentSchema,
} from "../validators/schemas";

/**
 * Equipamentos do documento 07.
 *
 * A reserva mensal para reposição entra no custo fixo, e daí no rateio — é por
 * isso que a categoria `equipment_reserve` é bloqueada para lançamento manual:
 * quem lançasse a reserva à mão pagaria duas vezes pelo mesmo desgaste.
 */
export class EquipmentController {
  private readonly access: BusinessAccess;

  constructor(private readonly deps: Dependencies) {
    this.access = new BusinessAccess(deps.businesses, deps.subscriptions);
  }

  create = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const input = parse(createEquipmentSchema, req.body);

    const equipment = await new RegisterEquipment(
      this.access,
      this.deps.equipment,
      this.deps.clock,
    ).execute(
      userIdOf(req),
      businessId,
      { ...input, acquisitionDate: toDate(input.acquisitionDate) },
    );
    res.status(201).json(serializeEquipment(equipment));
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const query = parse(listQuerySchema, req.query);

    const items = await new ListEquipment(this.access, this.deps.equipment).execute(
      userIdOf(req),
      businessId,
      { includeArchived: query.includeArchived === "true" },
    );
    res.json({ items: items.map(serializeEquipment) });
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);

    const equipment = await new GetEquipment(this.access, this.deps.equipment).execute(
      userIdOf(req),
      businessId,
      id,
    );
    res.json(serializeEquipment(equipment));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);
    const input = parse(updateEquipmentSchema, req.body);

    const equipment = await new UpdateEquipment(
      this.access,
      this.deps.equipment,
      this.deps.clock,
    ).execute(
      userIdOf(req),
      businessId,
      id,
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.acquisitionPriceCents !== undefined
          ? { acquisitionPriceCents: input.acquisitionPriceCents }
          : {}),
        ...(input.residualValueCents !== undefined
          ? { residualValueCents: input.residualValueCents }
          : {}),
        ...(input.usefulLifeMonths !== undefined
          ? { usefulLifeMonths: input.usefulLifeMonths }
          : {}),
        ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
        ...(input.acquisitionDate !== undefined
          ? { acquisitionDate: toDate(input.acquisitionDate) }
          : {}),
      },
    );
    res.json(serializeEquipment(equipment));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);

    await new DeleteEquipment(this.access, this.deps.equipment).execute(
      userIdOf(req),
      businessId,
      id,
    );
    res.status(204).end();
  };
}
