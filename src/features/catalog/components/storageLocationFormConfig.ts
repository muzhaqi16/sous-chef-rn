import type { KeyUnder } from '#/i18n';
import type { Translate } from '#/i18n/types';
import { StorageState, StorageType } from '#/graphql/generated/schemaTypes';
import { colors } from '#/theme/foundations/colors';

type FormKey = KeyUnder<'storageLocationForm'>;

/** Keyed by the enum, so a type the schema gains fails to compile until labelled. */
export const STORAGE_TYPE_LABEL_KEYS: Record<StorageType, FormKey> = {
  [StorageType.Refrigerator]: 'typeRefrigerator',
  [StorageType.Freezer]: 'typeFreezer',
  [StorageType.PantryShelf]: 'typePantryShelf',
  [StorageType.Cabinet]: 'typeCabinet',
  [StorageType.Drawer]: 'typeDrawer',
  [StorageType.Counter]: 'typeCounter',
  [StorageType.Basement]: 'typeBasement',
  [StorageType.Garage]: 'typeGarage',
  [StorageType.Closet]: 'typeCloset',
  [StorageType.Outdoor]: 'typeOutdoor',
  [StorageType.BoatStorage]: 'typeBoatStorage',
  [StorageType.RvStorage]: 'typeRvStorage',
  [StorageType.Custom]: 'typeCustom',
};

const STORAGE_TYPE_ORDER: StorageType[] = [
  StorageType.Refrigerator,
  StorageType.Freezer,
  StorageType.PantryShelf,
  StorageType.Cabinet,
  StorageType.Drawer,
  StorageType.Counter,
  StorageType.Basement,
  StorageType.Garage,
  StorageType.Closet,
  StorageType.Outdoor,
  StorageType.BoatStorage,
  StorageType.RvStorage,
  StorageType.Custom,
];

export const STORAGE_TYPE_VALUES: Array<{ key: FormKey; value: StorageType }> =
  STORAGE_TYPE_ORDER.map(value => ({
    key: STORAGE_TYPE_LABEL_KEYS[value],
    value,
  }));

export const TEMPERATURE_OPTION_VALUES: Array<{
  key: FormKey;
  value: StorageState;
}> = [
  { key: 'tempNone', value: StorageState.None },
  { key: 'tempAmbient', value: StorageState.Ambient },
  { key: 'tempRefrigerated', value: StorageState.Refrigerated },
  { key: 'tempFrozen', value: StorageState.Frozen },
];

export const COLOR_PRESETS: Array<{ key: FormKey; value: string }> = [
  { key: 'colorRed', value: colors.locationSwatches.red },
  { key: 'colorPink', value: colors.locationSwatches.pink },
  { key: 'colorPurple', value: colors.locationSwatches.purple },
  { key: 'colorBlue', value: colors.locationSwatches.blue },
  { key: 'colorTeal', value: colors.locationSwatches.teal },
  { key: 'colorGreen', value: colors.locationSwatches.green },
  { key: 'colorOrange', value: colors.locationSwatches.orange },
  { key: 'colorBrown', value: colors.locationSwatches.brown },
  { key: 'colorGrey', value: colors.locationSwatches.grey },
  { key: 'colorIndigo', value: colors.locationSwatches.indigo },
];

const CAPACITY_UNIT_VALUES: Array<{ key: FormKey; value: string }> = [
  { key: 'capacityLiters', value: 'liters' },
  { key: 'capacityGallons', value: 'gallons' },
  { key: 'capacityCubicFeet', value: 'cubic_feet' },
  { key: 'capacityCubicMeters', value: 'cubic_meters' },
  { key: 'capacityItems', value: 'items' },
];

export const buildCapacityUnitOptions = (t: Translate) =>
  CAPACITY_UNIT_VALUES.map(opt => ({
    label: t(`storageLocationForm.${opt.key}`),
    value: opt.value,
  }));
