import type { Request, Response } from "express";
import type { UnitSlug } from "../../../domain/catalog/catalogs";
import type { Dependencies } from "../../../application/ports/dependencies";
import { BusinessAccess } from "../../../application/services/business-access";
import { PriceService, SaveCalculation } from "../../../application/use-cases/price-service";
import {
  ArchiveService,
  CreateService,
  DeleteService,
  DuplicateService,
  GetService,
  ListServices,
  UpdateService,
  type ServiceInputData,
} from "../../../application/use-cases/services";
import { serializeCalculation, serializeService } from "../mappers/serializers";
import { userIdOf } from "../middleware/identity";
import { parse } from "../validators/parse";
import {
  businessParamSchema,
  createServiceSchema,
  duplicateServiceSchema,
  idParamSchema,
  listQuerySchema,
  priceServiceSchema,
  toFraction,
  updateServiceSchema,
} from "../validators/schemas";

export class ServiceController {
  private readonly access: BusinessAccess;

  constructor(private readonly deps: Dependencies) {
    this.access = new BusinessAccess(deps.businesses, deps.subscriptions);
  }

  create = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const input = parse(createServiceSchema, req.body);

    const service = await new CreateService(
      this.access,
      this.deps.services,
      this.deps.materials,
    ).execute(userIdOf(req), businessId, toServiceInput(input) as ServiceInputData);

    res.status(201).json(serializeService(service));
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const query = parse(listQuerySchema, req.query);

    const services = await new ListServices(this.access, this.deps.services).execute(
      userIdOf(req),
      businessId,
      { includeArchived: query.includeArchived === "true" },
    );

    res.json({ items: services.map(serializeService) });
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);

    const service = await new GetService(this.access, this.deps.services).execute(
      userIdOf(req),
      businessId,
      id,
    );
    res.json(serializeService(service));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);
    const input = parse(updateServiceSchema, req.body);

    const service = await new UpdateService(
      this.access,
      this.deps.services,
      this.deps.materials,
    ).execute(userIdOf(req), businessId, id, toServiceInput(input));

    res.json(serializeService(service));
  };

  duplicate = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);
    const input = parse(duplicateServiceSchema, req.body ?? {});

    const service = await new DuplicateService(this.access, this.deps.services).execute(
      userIdOf(req),
      businessId,
      id,
      input,
    );
    res.status(201).json(serializeService(service));
  };

  archive = async (req: Request, res: Response): Promise<void> => {
    res.json(serializeService(await this.setArchived(req, true)));
  };

  restore = async (req: Request, res: Response): Promise<void> => {
    res.json(serializeService(await this.setArchived(req, false)));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);

    await new DeleteService(this.access, this.deps.services, this.deps.calculations).execute(
      userIdOf(req),
      businessId,
      id,
    );
    res.status(204).end();
  };

  /**
   * Calcula o preço do serviço com os dados cadastrados.
   *
   * Com `save: true`, o resultado entra no histórico como fotografia imutável;
   * sem ele, é só uma simulação e nada é gravado.
   */
  price = async (req: Request, res: Response): Promise<void> => {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);
    const options = parse(priceServiceSchema, req.body ?? {});
    const userId = userIdOf(req);

    const priced = await new PriceService(
      this.access,
      this.deps.services,
      this.deps.materials,
      this.deps.fixedCosts,
      this.deps.businesses,
      this.deps.equipment,
      this.deps.clock,
    ).execute(userId, businessId, id, {
      ...(options.currentPriceCents !== undefined
        ? { currentPriceCents: options.currentPriceCents ?? null }
        : {}),
    });

    if (!options.save) {
      res.json({
        serviceId: id,
        result: priced.result,
        fixedCostBreakdown: priced.fixedCostBreakdown,
        saved: null,
      });
      return;
    }

    const saved = await new SaveCalculation(this.access, this.deps.calculations).execute(
      userId,
      businessId,
      { serviceId: id, input: priced.input, result: priced.result },
    );

    res.status(201).json({
      serviceId: id,
      result: priced.result,
      fixedCostBreakdown: priced.fixedCostBreakdown,
      saved: serializeCalculation(saved),
    });
  };

  private setArchived(req: Request, isArchived: boolean) {
    const { businessId } = parse(businessParamSchema, req.params);
    const { id } = parse(idParamSchema, req.params);

    return new ArchiveService(this.access, this.deps.services).execute(
      userIdOf(req),
      businessId,
      id,
      isArchived,
    );
  }
}

/** Percentual da borda vira fração; unidade opcional segue para a conversão. */
function toServiceInput(
  input: Partial<{
    name: string;
    category: string;
    durationMinutes: number;
    desiredMarginPercent: number;
    currentPriceCents: number | null | undefined;
    otherDirectCostCents: number;
    salesFeePercent: number;
    materials: { materialId: string; quantityUsed: number; unit?: string }[];
  }>,
): Partial<ServiceInputData> {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
    ...(input.desiredMarginPercent !== undefined
      ? { desiredMargin: toFraction(input.desiredMarginPercent) }
      : {}),
    ...(input.currentPriceCents !== undefined
      ? { currentPriceCents: input.currentPriceCents ?? null }
      : {}),
    ...(input.otherDirectCostCents !== undefined
      ? { otherDirectCostCents: input.otherDirectCostCents }
      : {}),
    ...(input.salesFeePercent !== undefined
      ? { salesFeePercentage: toFraction(input.salesFeePercent) }
      : {}),
    ...(input.materials !== undefined
      ? {
          materials: input.materials.map((item) => ({
            materialId: item.materialId,
            quantityUsed: item.quantityUsed,
            ...(item.unit !== undefined ? { unit: item.unit as UnitSlug } : {}),
          })),
        }
      : {}),
  };
}
