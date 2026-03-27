import React, { useContext } from 'react';
import type { ListRenderItemInfo } from '@shopify/flash-list';
import type { PantryItem } from '#generated';
import { PantryItemCard } from '../PantryItemCard';
import { DisplayMapContext } from './displayMapCache';

// Module-scope renderItem — stable reference, no closure recreation per render
export const renderItem = ({ item }: ListRenderItemInfo<PantryItem>) => {
  if (!item) return null;
  return <PantryRenderItem itemId={item.id} />;
};

// Module-scope bridge component — looks up pre-computed display data from context.
// React.memo is required because this is a FlashList renderItem (module-scope,
// parent not compiled by React Compiler).
const PantryRenderItemInner: React.FC<{ itemId: string }> = ({ itemId }) => {
  const displayMap = useContext(DisplayMapContext);
  const display = displayMap.get(itemId);
  if (!display) return null;
  return (
    <PantryItemCard
      id={display.id}
      name={display.name}
      expirationText={display.expirationText}
      expirationVariant={display.expirationVariant}
      expirationColor={display.expirationColor}
      quantity={display.quantityDisplay}
      location={display.location}
      variant={display.variant}
      imageUrl={display.imageUrl}
      isOutOfStock={display.isOutOfStock}
      packageBreakdownText={display.packageBreakdownText}
      remainingNetWeightText={display.remainingNetWeightText}
      quantityBreakdownText={display.quantityBreakdownText}
      activeBatchCount={display.activeBatchCount}
    />
  );
};

const PantryRenderItem = React.memo(PantryRenderItemInner);
