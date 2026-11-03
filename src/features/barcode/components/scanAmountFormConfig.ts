import { mixed, object, string, type ObjectSchema } from 'yup';
import { NetWeightKind, UnitType } from '#/graphql/generated/schemaTypes';
import { lazyMessage, quantityRule } from '#/utils/validation/common';
import { parseFractionalInput } from '#/utils/fractionUtils';
import {
  formatQuantityForInput,
  type QuantityDisplayOptions,
  unitLabel,
} from '#utils/formatQuantity';
import {
  statedContents,
  takesContents,
  type HeldUnit,
  type PackageContentsValues,
} from '#domain/stockAmount';
import type { ScanAmount, ScannedItem } from '#features/barcode/types';
import { readingOf, type ReadingSystem } from '#domain/measure';
import {
  isPickedWhenSized,
  isWholeWhenSized,
  packageContentsFields,
} from '#features/pantry/ui/packageContentsRules';

export interface ScanAmountFormValues extends PackageContentsValues {
  quantityInput: string;
  /** The unit as its field shows it; `unitId` is the unit picked. */
  unitDisplay: string;
  unitId: string | null;
}

interface UnitChoice {
  id: string;
  symbol: string;
  type?: UnitType | null;
}

// The API's own fallback for a count it has no unit for.
const PIECE_SYMBOL = 'pc';

const AS_DECIMAL: QuantityDisplayOptions = { notation: 'decimal' };

export const scanAmountSchema: ObjectSchema<ScanAmountFormValues> = object({
  quantityInput: quantityRule('barcode.amount.quantityInvalid').test(
    'whole-packages',
    lazyMessage('packageSize.wholePackages'),
    (value, context: { parent: ScanAmountFormValues }) =>
      isWholeWhenSized(
        value,
        context.parent.unitType,
        context.parent.sizeInput,
      ),
  ),
  unitDisplay: string().defined(),
  // Picked from the list, not typed: the amount is recorded in that unit's id.
  unitId: string()
    .nullable()
    .defined()
    .test(
      'unit-picked',
      lazyMessage('barcode.amount.unitRequired'),
      value => !!value,
    ),
  unitType: mixed<UnitType>()
    .oneOf(Object.values(UnitType))
    .nullable()
    .defined(),
  ...packageContentsFields,
  sizeUnitId: string()
    .nullable()
    .defined()
    .test(
      'size-unit-picked',
      lazyMessage('packageSize.unitRequired'),
      (value, context: { parent: ScanAmountFormValues }) =>
        isPickedWhenSized(
          value,
          context.parent.unitType,
          context.parent.sizeInput,
        ),
    ),
});

/** A package of several pieces ("6 x 250mL"), counted as its pieces. */
export const isMultipack = (item: ScannedItem): boolean =>
  (item.packs?.count ?? 1) > 1;

/**
 * The COUNT unit a scan is counted in: the pantry's counted stack of the item,
 * so a repeat scan joins it, else the container its label names (can, jar),
 * else a counted tracking unit (the API's), else the container households
 * count it in, which that unit reaches only for a sized pack, else a piece.
 */
export function packageUnitOf(
  item: ScannedItem,
  heldUnit: HeldUnit,
  units: readonly UnitChoice[],
): UnitChoice | null {
  const { trackingUnit } = item;
  if (heldUnit?.type === UnitType.Count) {
    const held =
      trackingUnit?.id === heldUnit.id
        ? trackingUnit
        : units.find(unit => unit.id === heldUnit.id);
    if (held) return held;
  }
  const container = item.packs?.container;
  if (container) return { ...container, type: UnitType.Count };
  if (trackingUnit?.type === UnitType.Count) return trackingUnit;
  const learned = item.suggestedPackageUnit;
  if (learned) return { ...learned, type: UnitType.Count };
  return (
    units.find(
      unit => unit.type === UnitType.Count && unit.symbol === PIECE_SYMBOL,
    ) ?? null
  );
}

/** The scanned pack's size as the user's unit system reads it, with its unit's id for the size field. */
const readingOfSize = (
  size: NonNullable<ScannedItem['packageSize']>,
  system: ReadingSystem,
) => {
  const { value, unitId, symbol } = readingOf(size, system);
  return { value, unit: { id: unitId, symbol } };
};

function packSizeOf(item: ScannedItem, system: ReadingSystem) {
  // A multipack's size is one piece's: the package's total is count × each.
  if (item.packs && isMultipack(item)) {
    return readingOfSize(item.packs.each, system);
  }
  if (item.packageSize) return readingOfSize(item.packageSize, system);
  return item.netWeightKind === NetWeightKind.Package &&
    item.netWeight != null &&
    item.displayUnit
    ? { value: item.netWeight, unit: item.displayUnit }
    : null;
}

/** The package unit as the form holds it; with none, the field is the user's. */
export function packageUnitFields(
  packageUnit: UnitChoice | null,
): Pick<ScanAmountFormValues, 'unitDisplay' | 'unitId' | 'unitType'> {
  return {
    unitDisplay: unitLabel(packageUnit),
    unitId: packageUnit?.id ?? null,
    unitType: packageUnit ? UnitType.Count : null,
  };
}

/**
 * One package of the product, in its package unit, holding the pack's size; a
 * multipack as its pieces ("6 can · 250 ml each").
 */
export function scanAmountDefaults(
  item: ScannedItem,
  packageUnit: UnitChoice | null,
  system: ReadingSystem,
): ScanAmountFormValues {
  const size = packSizeOf(item, system);
  return {
    quantityInput: String(
      item.packs && isMultipack(item) ? item.packs.count : 1,
    ),
    ...packageUnitFields(packageUnit),
    sizeInput: size ? formatQuantityForInput(size.value, AS_DECIMAL) : '',
    sizeUnitDisplay: unitLabel(size?.unit),
    sizeUnitId: size?.unit.id ?? null,
    sizeUnitType: null,
  };
}

/**
 * What a valid form records. The unit decides what it is: a measure is an
 * amount, and so is a part of a count; a whole count is packages. A size still
 * as prefilled is the record's, which the API applies itself, so only one the
 * user changed is sent. A multipack's prefill is one piece's size, never the
 * record's total, so it always goes.
 */
export function scanAmountOf(
  values: ScanAmountFormValues,
  prefilled: ScanAmountFormValues,
  { piecesPrefilled = false }: { piecesPrefilled?: boolean } = {},
): ScanAmount | null {
  const quantity = parseFractionalInput(values.quantityInput);
  const { unitId } = values;
  if (quantity === null || !unitId) return null;
  if (!takesContents(values.unitType) || !Number.isInteger(quantity)) {
    return { packaged: false, quantity, unitId };
  }
  const sizeChanged =
    piecesPrefilled ||
    values.sizeInput !== prefilled.sizeInput ||
    values.sizeUnitId !== prefilled.sizeUnitId;
  return {
    packaged: true,
    count: quantity,
    unitId,
    contents: sizeChanged ? statedContents(values) : null,
  };
}
