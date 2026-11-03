import {
  UnitType,
  type MeasurementProfileInput,
  type PackageSizeInput,
  type StockAmountInput,
} from '#/graphql/generated/schemaTypes';
import { parseDecimalInput } from '#/utils/parseDecimalInput';

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

/** What one package holds, as a person states it: 5 lb, or 10 can. */
export interface PackageContents {
  amount: number;
  unitId: string;
  /** Null for a unit whose kind is not known, which reads as a measure. */
  unitType: UnitType | null;
}

/** Whether what a person counts in this unit can hold something: a measure cannot. */
export const takesContents = (unitType: UnitType | null): boolean =>
  unitType === null || unitType === UnitType.Count;

/** The form fields that state one package's contents; `unitType` is the count's. */
export interface PackageContentsValues {
  unitType: UnitType | null;
  sizeInput: string;
  /** The unit as its field shows it; `sizeUnitId` is the unit picked. */
  sizeUnitDisplay: string;
  sizeUnitId: string | null;
  sizeUnitType: UnitType | null;
}

/** Whether a form states what a package holds. */
export const statesContents = ({
  unitType,
  sizeInput,
}: PackageContentsValues): boolean =>
  takesContents(unitType) && !!sizeInput.trim();

/** What a form states one package holds; null when it states nothing. */
export function statedContents(
  values: PackageContentsValues,
): PackageContents | null {
  if (!statesContents(values) || !values.sizeUnitId) return null;
  return {
    amount: parseDecimalInput(values.sizeInput),
    unitId: values.sizeUnitId,
    unitType: values.sizeUnitType,
  };
}

/**
 * What a write states for one package's contents. A measure is its size; a
 * count is a portion definition, which the server keeps for stock added later.
 * Whether a portion may be split stays the server's, seeded from the item.
 */
export function contentsOf(contents: PackageContents | null): {
  packageSize: PackageSizeInput | null;
  measurementProfile?: MeasurementProfileInput;
} {
  if (!contents) return { packageSize: null };
  if (contents.unitType === UnitType.Count) {
    return {
      packageSize: null,
      measurementProfile: {
        portionUnitId: contents.unitId,
        portionsPerTrackingUnit: contents.amount,
      },
    };
  }
  return {
    packageSize: {
      netWeight: contents.amount,
      netWeightUnitId: contents.unitId,
    },
  };
}

/** What a restock states for one package; `packageSize` makes it a count of packages. */
export interface RestockContents {
  packageSize: PackageSizeInput | null;
  measurementProfile?: MeasurementProfileInput;
  packagePortions?: number;
}

/**
 * As `contentsOf`, except that a count in the portion unit the stack already
 * uses describes this batch alone, and leaves the stack's definition as it is.
 */
export function restockContentsOf(
  contents: PackageContents,
  portionUnitId: string | null,
): RestockContents {
  return contents.unitType === UnitType.Count &&
    contents.unitId === portionUnitId
    ? { packageSize: null, packagePortions: contents.amount }
    : contentsOf(contents);
}

/** The unit of the stack the pantry already holds of a product. */
export type HeldUnit = { id: string; type: UnitType } | null;

interface BoughtOptions {
  /** Null or omitted when the pantry holds none, or the cache cannot say. */
  heldUnit?: HeldUnit;
  /** One package's net content, when the user or the record states it. */
  packageSize?: PackageSizeInput | null;
  /** The COUNT unit the buyer counted in, when they named one. */
  unitId?: string | null;
}

/**
 * `count` of a product bought. Never an amount in the unit the write defaults
 * to: that is the held stack's, so 1 lands as 1 mL of milk. A counted stack
 * counts one in its own unit; any other is packages, in the buyer's unit, for
 * the API to size or restate.
 */
export function boughtAmountOf(
  count: number,
  { heldUnit, packageSize, unitId }: BoughtOptions = {},
): StockAmountInput {
  if (heldUnit?.type === UnitType.Count) {
    return packageSize || (unitId != null && unitId !== heldUnit.id)
      ? stockAmountOf(count, { asPackages: true, packageSize, unitId })
      : stockAmountOf(count, { unitId: heldUnit.id });
  }
  // A stack held by weight refuses a package unit: count × size is what lands.
  return stockAmountOf(count, {
    asPackages: true,
    packageSize,
    unitId: packageSize ? null : unitId,
  });
}

/**
 * The row's amount until the server answers. Only the server turns packages
 * into grams, so a weighed line counted in packages keeps its own amount
 * meanwhile; every other count is that many of the unit.
 */
export function localQuantity(
  amount: StockAmountInput,
  line: { quantity?: number | null; unit?: { type: UnitType } | null },
): number {
  if (amount.measured) return amount.measured.quantity;
  const { count, unitId } = amount.packages;
  return unitId || !line.unit || line.unit.type === UnitType.Count
    ? count
    : line.quantity ?? count;
}
