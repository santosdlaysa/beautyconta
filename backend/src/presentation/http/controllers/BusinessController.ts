import type { Request, Response } from "express";
import type { SegmentSlug, WorkModelSlug } from "../../../domain/catalog/catalogs";
import type { Dependencies } from "../../../application/ports/dependencies";
import {
  CreateBusiness,
  GetBusiness,
  GetBusinessSettings,
  ListBusinesses,
  SaveBusinessSettings,
  UpdateBusiness,
} from "../../../application/use-cases/businesses";
import { BusinessAccess } from "../../../application/services/business-access";
import { ExportBusinessData } from "../../../application/use-cases/export-business-data";
import {
  serializeBusiness,
  serializeExport,
  serializeSettings,
} from "../mappers/serializers";
import { userIdOf } from "../middleware/identity";
import { parse } from "../validators/parse";
import {
  businessParamSchema,
  createBusinessSchema,
  settingsSchema,
  updateBusinessSchema,
} from "../validators/schemas";

export class BusinessController {
  private readonly access: BusinessAccess;

  constructor(private readonly deps: Dependencies) {
    this.access = new BusinessAccess(deps.businesses, deps.subscriptions);
  }

  create = async (req: Request, res: Response): Promise<void> => {
    const input = parse(createBusinessSchema, req.body);
    const business = await new CreateBusiness(
      this.deps.businesses,
      this.deps.users,
      this.deps.subscriptions,
    ).execute(
      userIdOf(req),
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        primaryCategory: input.primaryCategory as SegmentSlug,
        ...(input.secondaryCategories !== undefined
          ? { secondaryCategories: input.secondaryCategories as SegmentSlug[] }
          : {}),
        workModel: input.workModel as WorkModelSlug,
      },
    );
    res.status(201).json(serializeBusiness(business));
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const businesses = await new ListBusinesses(this.deps.businesses).execute(userIdOf(req));
    res.json({ items: businesses.map(serializeBusiness) });
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const business = await new GetBusiness(this.access).execute(userIdOf(req), businessId);
    res.json(serializeBusiness(business));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const input = parse(updateBusinessSchema, req.body);

    const business = await new UpdateBusiness(this.access, this.deps.businesses).execute(
      userIdOf(req),
      businessId,
      {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.primaryCategory !== undefined
          ? { primaryCategory: input.primaryCategory as SegmentSlug }
          : {}),
        ...(input.workModel !== undefined
          ? { workModel: input.workModel as WorkModelSlug }
          : {}),
        ...(input.secondaryCategories !== undefined
          ? { secondaryCategories: input.secondaryCategories as SegmentSlug[] }
          : {}),
      },
    );
    res.json(serializeBusiness(business));
  };

  getSettings = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const settings = await new GetBusinessSettings(this.access, this.deps.businesses).execute(
      userIdOf(req),
      businessId,
    );
    res.json(serializeSettings(settings));
  };

  /**
   * Exportação dos dados do negócio (`RF-12`).
   *
   * Sai como arquivo para download, com nome e data, porque o objetivo é a
   * pessoa **ficar** com a cópia — abrir um JSON no navegador não é isso.
   */
  export = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);

    const data = await new ExportBusinessData(
      this.access,
      this.deps.businesses,
      this.deps.materials,
      this.deps.fixedCosts,
      this.deps.services,
      this.deps.calculations,
      this.deps.equipment,
      this.deps.subscriptions,
      this.deps.clock,
    ).execute(userIdOf(req), businessId);

    const dia = data.exportedAt.toISOString().slice(0, 10);

    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("content-disposition", `attachment; filename="beautyconta-${dia}.json"`);
    res.json(serializeExport(data));
  };

  /** `PUT` porque a gravação é idempotente: o onboarding pode repetir a etapa. */
  saveSettings = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const input = parse(settingsSchema, req.body);

    const settings = await new SaveBusinessSettings(this.access, this.deps.businesses).execute(
      userIdOf(req),
      businessId,
      input,
    );
    res.json(serializeSettings(settings));
  };
}
