import type { OperationVariables } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import { CookingSkillLevel } from '#/graphql/generated/schemaTypes';
import { isRecord } from '#/utils/isRecord';
import { isOwnKey } from '#/utils/isOwnKey';
import { inputTypeOf } from './legacyExpiry';

/**
 * A write queued by a build that named units, brands, storage locations and
 * catalog items by `*Id`/`*Name` pairs. The API now takes `@oneOf` references
 * and refuses the old shape before any resolver runs, so each entry is rewritten
 * once, on load, into the shape this build sends.
 */

type Input = Record<string, unknown>;

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

/** A one-key reference, or undefined when neither half names anything. */
const ref = (id: unknown, name: unknown): Input | undefined => {
  const byId = text(id);
  if (byId) return { id: byId };
  const byName = text(name);
  return byName ? { name: byName } : undefined;
};

/** The old unit spec's fields, or null when `unit` is absent or already a reference. */
const legacyUnitSpec = (unit: unknown): Input | null =>
  isRecord(unit) &&
  ('unitId' in unit || 'unitName' in unit || 'unitSymbol' in unit)
    ? unit
    : null;

/**
 * `{ unitId, unitName, unitSymbol }` as `unit` + `unitLabel`: beside an id or a
 * symbol, the name was the line's label. `unit: undefined` names nothing.
 */
const unitFields = (spec: Input): { unit?: Input; unitLabel?: string } => {
  const name = text(spec.unitName);
  const id = text(spec.unitId);
  const symbol = text(spec.unitSymbol);
  const unit = id ? { id } : symbol ? { symbol } : name ? { name } : undefined;
  if (!unit) return {};
  return name && !('name' in unit) ? { unit, unitLabel: name } : { unit };
};

const withUnit = (input: Input, blankClears = false): Input => {
  const spec = legacyUnitSpec(input.unit);
  if (!spec) return input;
  const { unit: _legacy, ...rest } = input;
  const fields = unitFields(spec);
  if (fields.unit) return { ...rest, ...fields };
  return blankClears ? { ...rest, unit: null } : rest;
};

const withBrand = (input: Input): Input => {
  const brand = input.brand;
  if (!isRecord(brand) || !('brandId' in brand || 'brandName' in brand)) {
    return input;
  }
  const { brand: _legacy, ...rest } = input;
  if (brand.brandId === null) return { ...rest, brand: null };
  const next = ref(brand.brandId, brand.brandName);
  return next ? { ...rest, brand: next } : rest;
};

const withStorageLocation = (input: Input): Input => {
  const storage = input.storage;
  if (
    !isRecord(storage) ||
    !('storageLocationId' in storage || 'storageLocationName' in storage)
  ) {
    return input;
  }
  const { storageLocationId, storageLocationName, ...rest } = storage;
  const location = ref(storageLocationId, storageLocationName);
  return { ...input, storage: location ? { ...rest, location } : rest };
};

/** An inline item's `units` and `netWeights`, each unit by reference. */
const inlineItem = (item: Input): Input => {
  const units = Array.isArray(item.units)
    ? item.units.filter(isRecord).flatMap(row => {
        const { unitId, unitName, contentUnitId, contentUnitName, ...rest } =
          row;
        const unit = ref(unitId, unitName);
        if (!unit) return [];
        const contentUnit = ref(contentUnitId, contentUnitName);
        return [{ ...rest, unit, ...(contentUnit && { contentUnit }) }];
      })
    : item.units;
  const netWeights = Array.isArray(item.netWeights)
    ? item.netWeights.filter(isRecord).flatMap(row => {
        const { unitId, unitName, ...rest } = row;
        const unit = ref(unitId, unitName);
        return unit ? [{ ...rest, unit }] : [];
      })
    : item.netWeights;
  return {
    ...item,
    ...(units !== undefined && { units }),
    ...(netWeights !== undefined && { netWeights }),
  };
};

/** `itemId` / an inline `item` as `item: { id } | { inline }`, the id winning. */
const withItemSource = (input: Input): Input => {
  const { itemId, item, ...rest } = input;
  if (isRecord(item) && ('id' in item || 'inline' in item)) return input;
  const id = text(itemId);
  if (id) return { ...rest, item: { id } };
  return isRecord(item)
    ? { ...rest, item: { inline: inlineItem(item) } }
    : input;
};

const pantryItemWrite = (input: Input): Input =>
  withStorageLocation(withBrand(withUnit(withItemSource(input))));

const usageAmount = (input: Input): Input => {
  if (!('quantityUsed' in input || 'consumeAll' in input)) return input;
  const { quantityUsed, consumeAll, ...rest } = input;
  if (consumeAll === true) return { ...rest, amount: { all: true } };
  return typeof quantityUsed === 'number'
    ? { ...rest, amount: { quantity: quantityUsed } }
    : rest;
};

const packageSizeCorrection = (input: Input): Input => {
  if (!('packageSize' in input || 'portionsPerTrackingUnit' in input)) {
    return input;
  }
  const { packageSize, portionsPerTrackingUnit, ...rest } = input;
  const correction =
    packageSize != null ? { packageSize } : { portionsPerTrackingUnit };
  return { ...rest, correction };
};

const shoppingBatchAdd = (input: Input): Input => {
  if (!Array.isArray(input.items)) return input;
  const items: unknown[] = input.items;
  return {
    ...input,
    items: items.map(item =>
      isRecord(item) ? withBrand(withUnit(item)) : item,
    ),
  };
};

const purchasedMoveHints = (input: Input): Input => {
  if (!('pantryItemIds' in input)) return input;
  const { pantryItemIds, ...rest } = input;
  return { ...rest, pantryItemHints: pantryItemIds };
};

const SKILL_LEVELS = new Set<string>(Object.values(CookingSkillLevel));

/** The Title-case level an older build stored, as the enum it became. */
const dietarySkillLevel = (input: Input): Input => {
  const level = input.cookingSkillLevel;
  if (typeof level !== 'string' || SKILL_LEVELS.has(level)) return input;
  const { cookingSkillLevel: _legacy, ...rest } = input;
  const upper = level.trim().toUpperCase();
  return SKILL_LEVELS.has(upper) ? { ...rest, cookingSkillLevel: upper } : rest;
};

type RewrittenInput =
  | 'CreatePantryItemInput'
  | 'SyncPantryItemInput'
  | 'UpdatePantryItemInput'
  | 'CreatePantryItemUsageInput'
  | 'CorrectPantryItemPackageSizeInput'
  | 'AddItemsToShoppingListInput'
  | 'UpdateShoppingListItemInput'
  | 'MovePurchasedItemsToPantryInput'
  | 'UpdateDietaryProfileInput';

const REWRITES: Readonly<Record<RewrittenInput, (input: Input) => Input>> = {
  CreatePantryItemInput: pantryItemWrite,
  SyncPantryItemInput: pantryItemWrite,
  UpdatePantryItemInput: pantryItemWrite,
  CreatePantryItemUsageInput: usageAmount,
  CorrectPantryItemPackageSizeInput: packageSizeCorrection,
  AddItemsToShoppingListInput: shoppingBatchAdd,
  // A blank unit on an edit was the user emptying it.
  UpdateShoppingListItemInput: input => withBrand(withUnit(input, true)),
  MovePurchasedItemsToPantryInput: purchasedMoveHints,
  UpdateDietaryProfileInput: dietarySkillLevel,
};

export const withRefInputs = (
  document: DocumentNode,
  variables: OperationVariables,
): OperationVariables => {
  const input: unknown = variables.input;
  const inputType = inputTypeOf(document);
  if (!inputType || !isOwnKey(REWRITES, inputType) || !isRecord(input)) {
    return variables;
  }
  const next = REWRITES[inputType](input);
  return next === input ? variables : { ...variables, input: next };
};
