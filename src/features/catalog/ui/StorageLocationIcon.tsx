import React from 'react';
import type { SvgProps } from 'react-native-svg';
import { StorageType } from '#/graphql/generated/schemaTypes';
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

const SVG_MAP: Record<StorageType, React.FC<SvgProps>> = {
  [StorageType.Refrigerator]: Refrigerator,
  [StorageType.Freezer]: Freezer,
  [StorageType.PantryShelf]: PantryShelf,
  [StorageType.Cabinet]: Cabinet,
  [StorageType.Drawer]: Drawer,
  [StorageType.Counter]: Counter,
  [StorageType.Basement]: Basement,
  [StorageType.Garage]: GarageOutdoor,
  [StorageType.Outdoor]: GarageOutdoor,
  [StorageType.Closet]: ClosedStorage,
  [StorageType.BoatStorage]: BoatRvStorage,
  [StorageType.RvStorage]: BoatRvStorage,
  [StorageType.Custom]: Custom,
};

interface StorageLocationIconProps {
  type: StorageType;
  size?: number;
  color?: string;
}

export const StorageLocationIcon: React.FC<StorageLocationIconProps> = ({
  type,
  size = 24,
  color,
}) => {
  // A type the API added after this build has no entry.
  const Svg = type in SVG_MAP ? SVG_MAP[type] : Custom;
  return <Svg width={size} height={size} color={color} />;
};
