import React from 'react';
import { withUnistyles } from 'react-native-unistyles';
import type { IconSizeName } from '#components/atoms/Icon';
import { sizes } from '#theme/foundations/sizes';
import { StorageType } from '#graphql/generated/schemaTypes';
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

// Wrapped once each, so a size step resolves from the theme as density scales.
const ThemedRefrigerator = withUnistyles(Refrigerator);
const ThemedFreezer = withUnistyles(Freezer);
const ThemedPantryShelf = withUnistyles(PantryShelf);
const ThemedCabinet = withUnistyles(Cabinet);
const ThemedDrawer = withUnistyles(Drawer);
const ThemedCounter = withUnistyles(Counter);
const ThemedBasement = withUnistyles(Basement);
const ThemedGarageOutdoor = withUnistyles(GarageOutdoor);
const ThemedClosedStorage = withUnistyles(ClosedStorage);
const ThemedBoatRvStorage = withUnistyles(BoatRvStorage);
const ThemedCustom = withUnistyles(Custom);

const SVG_MAP: Record<StorageType, typeof ThemedCustom> = {
  [StorageType.Refrigerator]: ThemedRefrigerator,
  [StorageType.Freezer]: ThemedFreezer,
  [StorageType.PantryShelf]: ThemedPantryShelf,
  [StorageType.Cabinet]: ThemedCabinet,
  [StorageType.Drawer]: ThemedDrawer,
  [StorageType.Counter]: ThemedCounter,
  [StorageType.Basement]: ThemedBasement,
  [StorageType.Garage]: ThemedGarageOutdoor,
  [StorageType.Outdoor]: ThemedGarageOutdoor,
  [StorageType.Closet]: ThemedClosedStorage,
  [StorageType.BoatStorage]: ThemedBoatRvStorage,
  [StorageType.RvStorage]: ThemedBoatRvStorage,
  [StorageType.Custom]: ThemedCustom,
};

interface StorageLocationIconProps {
  type: StorageType;
  /** A step of the icon ramp, which scales with display density. */
  size?: IconSizeName;
  color?: string;
}

export const StorageLocationIcon: React.FC<StorageLocationIconProps> = ({
  type,
  size = 'md',
  color,
}) => {
  // A type the API added after this build has no entry.
  const Svg = type in SVG_MAP ? SVG_MAP[type] : ThemedCustom;
  // `uniProps` wins over the props, which carry the size until it resolves.
  const px = sizes.icon[size];
  return (
    <Svg
      width={px}
      height={px}
      color={color}
      uniProps={theme => ({
        width: theme.sizes.icon[size],
        height: theme.sizes.icon[size],
      })}
    />
  );
};
