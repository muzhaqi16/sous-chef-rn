import {
  UnitType,
  type PackageSizeInput,
  type StockAmountInput,
} from '#/graphql/generated/schemaTypes';

interface StockAmountOptions {
  /** Records `quantity` as that many whole packages, not an amount in a unit. */
  asPackages?: boolean;
  /** One package's net content; omitted, the API's own size for the item. */
  packageSize?: PackageSizeInput | null;
  /**
   * The unit `quantity` is in: a measured amount's, or the COUNT unit packages
   * are counted in. Omitted, the write's default unit.
   */
  unitId?: string | null;
}

/**
 * The `amount` a create, a restock or a move records, as stated: the API owns
 * the package arithmetic. When an amount is packages is each caller's rule.
 */
export function stockAmountOf(
  quantity: number,
  { asPackages = false, packageSize, unitId }: StockAmountOptions = {},
): StockAmountInput {
  if (asPackages) {
    return {
      packages: {
        count: quantity,
        ...(packageSize ? { size: packageSize } : {}),
        ...(unitId == null ? {} : { unitId }),
      },
    };
  }
  return { measured: unitId == null ? { quantity } : { quantity, unitId } };
}

/**
 * The row's amount until the server answers. Packages counted in a named unit,
 * or on a counted line, are that many of it; on a weighed line only the server
 * can turn packages into grams, so the row shows the line's own amount meanwhile.
 */
export function localQuantity(
  amount: StockAmountInput,
  line: { quantity?: number | null; unit?: { type: UnitType } | null },
): number {
  if (amount.measured) return amount.measured.quantity;
  const { count, unitId } = amount.packages;
  return unitId || line.unit?.type === UnitType.Count
    ? count
    : line.quantity ?? count;
}
