import type { useTranslation } from '#/i18n';
import { StorageState } from '#/graphql/generated/schemaTypes';

export type TFn = ReturnType<typeof useTranslation>['t'];

export const STORAGE_TYPE_VALUES = [
  { key: 'typeRefrigerator', value: 'REFRIGERATOR' },
  { key: 'typeFreezer', value: 'FREEZER' },
  { key: 'typePantryShelf', value: 'PANTRY_SHELF' },
  { key: 'typeCabinet', value: 'CABINET' },
  { key: 'typeDrawer', value: 'DRAWER' },
  { key: 'typeCounter', value: 'COUNTER' },
  { key: 'typeBasement', value: 'BASEMENT' },
  { key: 'typeGarage', value: 'GARAGE' },
  { key: 'typeCloset', value: 'CLOSET' },
  { key: 'typeOutdoor', value: 'OUTDOOR' },
  { key: 'typeBoatStorage', value: 'BOAT_STORAGE' },
  { key: 'typeRvStorage', value: 'RV_STORAGE' },
  { key: 'typeCustom', value: 'CUSTOM' },
];

export const TEMPERATURE_OPTION_VALUES: Array<{
  key: string;
  value: StorageState;
}> = [
  { key: 'tempNone', value: StorageState.None },
  { key: 'tempAmbient', value: StorageState.Ambient },
  { key: 'tempRefrigerated', value: StorageState.Refrigerated },
  { key: 'tempFrozen', value: StorageState.Frozen },
];

export const COLOR_PRESETS = [
  { key: 'colorRed', value: '#E53935' },
  { key: 'colorPink', value: '#D81B60' },
  { key: 'colorPurple', value: '#8E24AA' },
  { key: 'colorBlue', value: '#1E88E5' },
  { key: 'colorTeal', value: '#00897B' },
  { key: 'colorGreen', value: '#43A047' },
  { key: 'colorOrange', value: '#FB8C00' },
  { key: 'colorBrown', value: '#6D4C41' },
  { key: 'colorGrey', value: '#757575' },
  { key: 'colorIndigo', value: '#3949AB' },
];

const CAPACITY_UNIT_VALUES = [
  { key: 'capacityLiters', value: 'liters' },
  { key: 'capacityGallons', value: 'gallons' },
  { key: 'capacityCubicFeet', value: 'cubic_feet' },
  { key: 'capacityCubicMeters', value: 'cubic_meters' },
  { key: 'capacityItems', value: 'items' },
];

export const buildCapacityUnitOptions = (t: TFn) =>
  CAPACITY_UNIT_VALUES.map(opt => ({
    label: t(`storageLocationForm.${opt.key}`),
    value: opt.value,
  }));
