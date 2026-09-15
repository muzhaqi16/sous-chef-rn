/**
 * Shared option lists and i18n keys for `ItemCondition` / `AcquisitionMethod`,
 * so the sheet pages and the full-screen form render the same labels rather than
 * each formatting the enum its own way.
 */
import {
  ItemCondition,
  AcquisitionMethod,
} from '#/graphql/generated/schemaTypes';
import type { TranslationKey } from '#/i18n';

/** Conditions a user picks, in display order. */
export const ITEM_CONDITION_OPTIONS = [
  ItemCondition.Good,
  ItemCondition.Fair,
  ItemCondition.Spoiled,
  ItemCondition.Expired,
];

const CONDITION_LABEL_KEYS: Record<ItemCondition, TranslationKey> = {
  [ItemCondition.Good]: 'addToPantry.conditionGood',
  [ItemCondition.Fair]: 'addToPantry.conditionFair',
  [ItemCondition.Spoiled]: 'addToPantry.conditionSpoiled',
  [ItemCondition.Expired]: 'addToPantry.conditionExpired',
};

export const conditionLabelKey = (value: ItemCondition): TranslationKey =>
  CONDITION_LABEL_KEYS[value];

/**
 * Acquisition methods a user picks when manually adding. BARCODE_SCAN /
 * SHOPPING_LIST are set automatically by those flows, so they're not offered.
 */
export type OfferedAcquisitionMethod =
  | AcquisitionMethod.Purchased
  | AcquisitionMethod.Homegrown
  | AcquisitionMethod.Gifted
  | AcquisitionMethod.Other;

export const ACQUISITION_METHOD_OPTIONS: OfferedAcquisitionMethod[] = [
  AcquisitionMethod.Purchased,
  AcquisitionMethod.Homegrown,
  AcquisitionMethod.Gifted,
  AcquisitionMethod.Other,
];

const ACQUISITION_METHOD_LABEL_KEYS: Record<AcquisitionMethod, TranslationKey> =
  {
    [AcquisitionMethod.Purchased]: 'addToPantry.methodPurchased',
    [AcquisitionMethod.BarcodeScan]: 'addToPantry.methodBarcodeScan',
    [AcquisitionMethod.ShoppingList]: 'shoppingListScreen.label',
    [AcquisitionMethod.Homegrown]: 'addToPantry.methodHomegrown',
    [AcquisitionMethod.Gifted]: 'addToPantry.methodGifted',
    [AcquisitionMethod.Other]: 'itemType.OTHER',
  };

export const acquisitionMethodLabelKey = (
  value: AcquisitionMethod,
): TranslationKey => ACQUISITION_METHOD_LABEL_KEYS[value];
