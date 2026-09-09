import type { Request, Response } from "express";
import type { UnitSlug } from "../../../domain/catalog/catalogs";
import type { Dependencies } from "../../../application/ports/dependencies";
import { BusinessAccess } from "../../../application/services/business-access";
import {
  ArchiveMaterial,
  DeleteMaterial,
  GetMaterial,
  ListMaterials,
  RegisterMaterial,
  UpdateMaterial,
} from "../../../application/use-cases/materials";
import { serializeMaterial } from "../mappers/serializers";
import { userIdOf } from "../middleware/identity";
import { parse } from "../validators/parse";
import {
  businessParamSchema,
  createMaterialSchema,
  idParamSchema,
  listQuerySchema,
  toDate,
  toFraction,
  updateMaterialSchema,
} from "../validators/schemas";

export class MaterialController {
  private readonly access: BusinessAccess;

  constructor(private readonly deps: Dependencies) {
    this.access = new BusinessAccess(deps.businesses, deps.subscriptions);
  }

  create = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const input = parse(createMaterialSchema, req.body);

    const material = await new RegisterMaterial(this.access, this.deps.materials).execute(
      userIdOf(req),
      businessId,
      {
        name: input.name,
        category: input.category,
        purchasePriceCents: input.purchasePriceCents,
        purchaseQuantity: input.purchaseQuantity,
        unit: input.unit as UnitSlug,
        ...(input.wastePercent !== undefined
          ? { wastePercentage: toFraction(input.wastePercent) }
          : {}),
        ...(input.purchaseDate !== undefined
          ? { purchaseDate: input.purchaseDate ? toDate(input.purchaseDate) : null }
          : {}),
      },
    );

    res.status(201).json(serializeMaterial(material));
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const query = parse(listQuerySchema, req.query);

    const materials = await new ListMaterials(this.access, this.deps.materials).execute(
      userIdOf(req),
      businessId,
      { includeArchived: query.includeArchived === "true" },
    );

    res.json({ items: materials.map(serializeMaterial) });
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);

    const material = await new GetMaterial(this.access, this.deps.materials).execute(
      userIdOf(req),
      businessId,
      id,
    );
    res.json(serializeMaterial(material));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);
    const input = parse(updateMaterialSchema, req.body);

    const material = await new UpdateMaterial(this.access, this.deps.materials).execute(
      userIdOf(req),
      businessId,
      id,
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.purchasePriceCents !== undefined
          ? { purchasePriceCents: input.purchasePriceCents }
          : {}),
        ...(input.purchaseQuantity !== undefined
          ? { purchaseQuantity: input.purchaseQuantity }
          : {}),
        ...(input.unit !== undefined ? { unit: input.unit as UnitSlug } : {}),
        ...(input.wastePercent !== undefined
          ? { wastePercentage: toFraction(input.wastePercent) }
          : {}),
        ...(input.purchaseDate !== undefined
          ? { purchaseDate: input.purchaseDate ? toDate(input.purchaseDate) : null }
          : {}),
      },
    );

    res.json(serializeMaterial(material));
  };

  /** Arquivar preserva o histórico; excluir só é possível fora de qualquer serviço. */
  archive = async (req: Request, res: Response): Promise<void> => {
    res.json(serializeMaterial(await this.setArchived(req, true)));
  };

  restore = async (req: Request, res: Response): Promise<void> => {
    res.json(serializeMaterial(await this.setArchived(req, false)));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);

    await new DeleteMaterial(this.access, this.deps.materials).execute(
      userIdOf(req),
      businessId,
      id,
    );
    res.status(204).end();
  };

  private setArchived(req: Request, isArchived: boolean) {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);

    return new ArchiveMaterial(this.access, this.deps.materials).execute(
      userIdOf(req),
      businessId,
      id,
      isArchived,
    );
  }
}
