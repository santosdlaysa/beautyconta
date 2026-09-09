import type { Request, Response } from "express";
import {
  EQUIPMENT_TYPES,
  FIXED_COST_CATEGORIES,
  MATERIAL_CATEGORIES,
  SEGMENTS,
  SERVICE_CATEGORIES,
  UNITS,
  WORK_MODELS,
  materialCategoriesFor,
  serviceCategoriesFor,
  type SegmentSlug,
} from "../../../domain/catalog/catalogs";

/**
 * Catálogos do documento 06.
 *
 * Público e sem cadastro: o aplicativo e a web precisam das listas antes de a
 * usuária ter conta. O parâmetro `segment` prioriza as categorias do segmento
 * escolhido no onboarding, mantendo as transversais visíveis.
 */
export class CatalogController {
  all = (req: Request, res: Response): void => {
    const segment = parseSegment(req.query.segment);

    res.json({
      segments: SEGMENTS,
      workModels: WORK_MODELS,
      units: UNITS,
      materialCategories: segment ? materialCategoriesFor(segment) : MATERIAL_CATEGORIES,
      fixedCostCategories: FIXED_COST_CATEGORIES,
      serviceCategories: segment ? serviceCategoriesFor(segment) : SERVICE_CATEGORIES,
      equipmentTypes: EQUIPMENT_TYPES,
    });
  };

  segments = (_req: Request, res: Response): void => {
    res.json({ items: SEGMENTS });
  };

  workModels = (_req: Request, res: Response): void => {
    res.json({ items: WORK_MODELS });
  };

  units = (_req: Request, res: Response): void => {
    res.json({ items: UNITS });
  };

  materialCategories = (req: Request, res: Response): void => {
    const segment = parseSegment(req.query.segment);
    res.json({ items: segment ? materialCategoriesFor(segment) : MATERIAL_CATEGORIES });
  };

  fixedCostCategories = (_req: Request, res: Response): void => {
    res.json({ items: FIXED_COST_CATEGORIES });
  };

  serviceCategories = (req: Request, res: Response): void => {
    const segment = parseSegment(req.query.segment);
    res.json({ items: segment ? serviceCategoriesFor(segment) : SERVICE_CATEGORIES });
  };

  equipmentTypes = (_req: Request, res: Response): void => {
    res.json({ items: EQUIPMENT_TYPES });
  };
}

/** Segmento desconhecido devolve a lista completa, em vez de recusar. */
function parseSegment(value: unknown): SegmentSlug | null {
  if (typeof value !== "string") return null;
  const found = SEGMENTS.find((segment) => segment.slug === value);
  return found ? found.slug : null;
}
