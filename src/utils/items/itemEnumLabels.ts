/**
 * Shared option lists and i18n keys for `ItemCondition` / `AcquisitionMethod`,
 * so the sheet pages and the full-screen form render the same labels rather than
 * each formatting the enum its own way.
 */
import {
  ItemCondition,
  AcquisitionMethod,
} from '#/graphql/generated/schemaTypes';

/** Conditions a user picks, in display order. */
export const ITEM_CONDITION_OPTIONS = [
  ItemCondition.Good,
  ItemCondition.Fair,
  ItemCondition.Spoiled,
  ItemCondition.Expired,
];

const CONDITION_LABEL_KEYS: Partial<Record<ItemCondition, string>> = {
  [ItemCondition.Good]: 'addToPantry.conditionGood',
  [ItemCondition.Fair]: 'addToPantry.conditionFair',
  [ItemCondition.Spoiled]: 'addToPantry.conditionSpoiled',
  [ItemCondition.Expired]: 'addToPantry.conditionExpired',
};

/** i18n key for an `ItemCondition` (falls back to the raw value if unmapped). */
export const conditionLabelKey = (value: ItemCondition): string =>
  CONDITION_LABEL_KEYS[value] ?? value;

/**
 * Acquisition methods a user picks when manually adding. BARCODE_SCAN /
 * SHOPPING_LIST are set automatically by those flows, so they're not offered.
 */
export const ACQUISITION_METHOD_OPTIONS = [
  AcquisitionMethod.Purchased,
  AcquisitionMethod.Homegrown,
  AcquisitionMethod.Gifted,
  AcquisitionMethod.Other,
];

const ACQUISITION_METHOD_LABEL_KEYS: Partial<
  Record<AcquisitionMethod, string>
> = {
  [AcquisitionMethod.Purchased]: 'addToPantry.methodPurchased',
  [AcquisitionMethod.Homegrown]: 'addToPantry.methodHomegrown',
  [AcquisitionMethod.Gifted]: 'addToPantry.methodGifted',
  [AcquisitionMethod.Other]: 'itemType.OTHER',
};

/** i18n key for an `AcquisitionMethod` (falls back to the raw value if unmapped). */
export const acquisitionMethodLabelKey = (value: AcquisitionMethod): string =>
  ACQUISITION_METHOD_LABEL_KEYS[value] ?? value;
