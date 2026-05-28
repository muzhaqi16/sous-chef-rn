import React from 'react';
import type { ListRenderItemInfo } from '@shopify/flash-list';
import { PantryItemCard } from '../PantryItemCard';
import type { PantryListItemNode } from '#hooks/home/pantry/usePantryQuery';

/**
 * List item shape consumed by `renderItem` — the `GetPantry` node shape.
 * Carries direct fields the screen-level hooks read (id, itemName, …) plus
 * an opaque `PantryItemCard_pantryItem` fragment ref that the leaf
 * `PantryItemCard` unmasks via `useFragment`.
 */
export type PantryListNode = PantryListItemNode;

// Module-scope renderItem — stable reference, no closure recreation per render.
// Each leaf owns its own cache subscription via useFragment, so the bridge
// component that previously read from DisplayMapContext is no longer needed.
export const renderItem = ({ item }: ListRenderItemInfo<PantryListNode>) => {
  if (!item) return null;
  return <PantryItemCard pantryItemRef={item} />;
};
