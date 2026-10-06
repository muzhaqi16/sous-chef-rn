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
  /** The unit a measured `quantity` is in; omitted, the write's default unit. */
  unitId?: string | null;
}

/**
 * The `amount` a restock or a move records, as stated: the API owns the package
 * arithmetic. When an amount is packages is each caller's rule.
 */
export function stockAmountOf(
  quantity: number,
  { asPackages = false, packageSize, unitId }: StockAmountOptions = {},
): StockAmountInput {
  if (asPackages) {
    return {
      packages: packageSize
        ? { count: quantity, size: packageSize }
        : { count: quantity },
    };
  }
  return { measured: unitId == null ? { quantity } : { quantity, unitId } };
}

/**
 * The row's amount until the server answers. Packages of a counted line are
 * that many of it; on a weighed line only the server can turn packages into
 * grams, so the row shows the line's own amount meanwhile.
 */
export function localQuantity(
  amount: StockAmountInput,
  line: { quantity?: number | null; unit?: { type: UnitType } | null },
): number {
  if (amount.measured) return amount.measured.quantity;
  const { count } = amount.packages;
  return line.unit?.type === UnitType.Count ? count : line.quantity ?? count;
}
