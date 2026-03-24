import React from 'react';
import type { SvgProps } from 'react-native-svg';
import Refrigerator from '#assets/icons/svg/storageLocations/refrigerator.svg';
import Freezer from '#assets/icons/svg/storageLocations/freezer.svg';
import PantryShelf from '#assets/icons/svg/storageLocations/pantry-shelf.svg';
import Cabinet from '#assets/icons/svg/storageLocations/cabinet.svg';
import Drawer from '#assets/icons/svg/storageLocations/drawer.svg';
import Counter from '#assets/icons/svg/storageLocations/counter.svg';
import Basement from '#assets/icons/svg/storageLocations/basement.svg';
import GarageOutdoor from '#assets/icons/svg/storageLocations/garage-outdoor.svg';
import ClosedStorage from '#assets/icons/svg/storageLocations/closed-storage.svg';
import BoatRvStorage from '#assets/icons/svg/storageLocations/boat-rv-storage.svg';
import Custom from '#assets/icons/svg/storageLocations/custom.svg';

const SVG_MAP: Record<string, React.FC<SvgProps>> = {
  REFRIGERATOR: Refrigerator,
  FREEZER: Freezer,
  PANTRY_SHELF: PantryShelf,
  CABINET: Cabinet,
  DRAWER: Drawer,
  COUNTER: Counter,
  BASEMENT: Basement,
  GARAGE: GarageOutdoor,
  OUTDOOR: GarageOutdoor,
  CLOSET: ClosedStorage,
  BOAT_STORAGE: BoatRvStorage,
  RV_STORAGE: BoatRvStorage,
  CUSTOM: Custom,
};

interface StorageLocationIconProps {
  type: string;
  size?: number;
  color?: string;
}

export const StorageLocationIcon: React.FC<StorageLocationIconProps> = ({
  type,
  size = 24,
  color,
}) => {
  const SvgComponent = SVG_MAP[type] ?? Custom;
  return <SvgComponent width={size} height={size} color={color} />;
};
