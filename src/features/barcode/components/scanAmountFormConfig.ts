import { boolean, mixed, object, string, type ObjectSchema } from 'yup';
import { NetWeightKind, UnitType } from '#/graphql/generated/schemaTypes';
import {
  lazyMessage,
  positiveDecimalRule,
  quantityRule,
} from '#/utils/validation/common';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import {
  formatQuantityForInput,
  type QuantityDisplayOptions,
  unitLabel,
} from '#utils/formatQuantity';
import type { HeldUnit } from '#domain/stockAmount';
import type { ScanAmount, ScannedItem } from '#features/barcode/types';
import { readingOf, type ReadingSystem } from '#domain/measure';

export interface ScanAmountFormValues {
  packaged: boolean;
  quantityInput: string;
  /** The unit as its field shows it; `unitId` is the unit picked. */
  unitDisplay: string;
  unitId: string | null;
  unitType: UnitType | null;
  sizeInput: string;
  sizeUnitDisplay: string;
  sizeUnitId: string | null;
  /** The unit the household uses it in (tbsp for honey); empty for none. */
  consumeUnitDisplay: string;
  consumeUnitId: string | null;
}

interface UnitChoice {
  id: string;
  symbol: string;
  type?: UnitType | null;
}

// The API's own fallback for a count it has no unit for.
const PIECE_SYMBOL = 'pc';

const AS_DECIMAL: QuantityDisplayOptions = { notation: 'decimal' };

const packagedOnly =
  (test: (value: ScanAmountFormValues) => boolean) =>
  (_: unknown, context: { parent: ScanAmountFormValues }) =>
    !context.parent.packaged || test(context.parent);

export const scanAmountSchema: ObjectSchema<ScanAmountFormValues> = object({
  packaged: boolean().defined(),
  quantityInput: quantityRule('barcode.amount.quantityInvalid').test(
    'whole-packages',
    lazyMessage('barcode.amount.wholePackages'),
    packagedOnly(({ quantityInput }) =>
      Number.isInteger(parseFractionalInput(quantityInput)),
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
    )
    .test(
      'count-unit',
      lazyMessage('barcode.amount.countUnit'),
      packagedOnly(({ unitType }) => unitType === UnitType.Count),
    ),
  unitType: mixed<UnitType>()
    .oneOf(Object.values(UnitType))
    .nullable()
    .defined(),
  sizeInput: positiveDecimalRule('barcode.amount.sizeInvalid', {
    optional: true,
  }),
  sizeUnitDisplay: string().defined(),
  sizeUnitId: string()
    .nullable()
    .defined()
    .test(
      'size-unit-picked',
      lazyMessage('barcode.amount.sizeUnitRequired'),
      packagedOnly(
        ({ sizeInput, sizeUnitId }) => !sizeInput.trim() || !!sizeUnitId,
      ),
    ),
  consumeUnitDisplay: string().defined(),
  consumeUnitId: string()
    .nullable()
    .defined()
    .test(
      'consume-unit-picked',
      lazyMessage('barcode.amount.unitRequired'),
      (value, context: { parent: ScanAmountFormValues }) =>
        !context.parent.consumeUnitDisplay.trim() || !!value,
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
    packaged: true,
    quantityInput: String(
      item.packs && isMultipack(item) ? item.packs.count : 1,
    ),
    ...packageUnitFields(packageUnit),
    sizeInput: size ? formatQuantityForInput(size.value, AS_DECIMAL) : '',
    sizeUnitDisplay: unitLabel(size?.unit),
    sizeUnitId: size?.unit.id ?? null,
    consumeUnitDisplay: '',
    consumeUnitId: null,
  };
}

/**
 * What a valid form records. A size still as prefilled is the record's, which
 * the API applies itself, so only one the user changed is sent. A multipack's
 * prefill is one piece's size, never the record's total, so it always goes.
 */
export function scanAmountOf(
  values: ScanAmountFormValues,
  prefilled: ScanAmountFormValues,
  { piecesPrefilled = false }: { piecesPrefilled?: boolean } = {},
): ScanAmount | null {
  const quantity = parseFractionalInput(values.quantityInput);
  const { unitId } = values;
  if (quantity === null || !unitId) return null;
  const consumeUnitId = values.consumeUnitDisplay.trim()
    ? values.consumeUnitId
    : null;
  if (!values.packaged) {
    return { packaged: false, quantity, unitId, consumeUnitId };
  }
  const sizeChanged =
    piecesPrefilled ||
    values.sizeInput !== prefilled.sizeInput ||
    values.sizeUnitId !== prefilled.sizeUnitId;
  const size =
    sizeChanged && values.sizeInput.trim() && values.sizeUnitId
      ? {
          netWeight: parseDecimalInput(values.sizeInput),
          netWeightUnitId: values.sizeUnitId,
        }
      : null;
  return { packaged: true, count: quantity, unitId, size, consumeUnitId };
}
