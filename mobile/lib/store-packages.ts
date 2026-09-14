type Package = { identifier: string; product: { identifier: string } };
type Offering<T> = { identifier: string; availablePackages: T[] };

/** As duas ofertas usam $rc_monthly; a seleção precisa identificar também a oferta e o produto. */
export function storePackages<T extends Package>(offerings: {
  current: Offering<T> | null;
  all: Record<string, Offering<T>>;
}): { id: string; package: T }[] {
  const products = new Set<string>();
  const result: { id: string; package: T }[] = [];
  for (const offering of [offerings.current, offerings.all.default, offerings.all.master]) {
    if (!offering) continue;
    for (const item of offering.availablePackages) {
      if (products.has(item.product.identifier)) continue;
      products.add(item.product.identifier);
      result.push({ id: JSON.stringify([offering.identifier, item.identifier, item.product.identifier]), package: item });
    }
  }
  return result;
}
