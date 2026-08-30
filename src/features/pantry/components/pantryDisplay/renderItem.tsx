import React from 'react';
import type { ListRenderItemInfo } from '@shopify/flash-list';
import { PantryItemCard } from '../PantryItemCard';
import type { PantryListItemNode } from '#features/pantry/hooks/usePantryQuery';
import {
  isStickyHeaderSentinel,
  type StickyHeaderSentinel,
} from '#utils/flashListDefaults';
import { PantryStickyTabs } from './PantryStickyTabs';

/**
 * The `GetPantry` node shape: direct fields the screen-level hooks read, plus
 * an opaque `PantryItemCard_pantryItem` ref the leaf unmasks via `useFragment`.
 */
export type PantryListNode = PantryListItemNode;

// Module scope: stable reference, no closure recreated per render. Each leaf
// owns its cache subscription via useFragment.
export const renderItem = ({ item }: ListRenderItemInfo<PantryListNode>) => {
  if (!item) return null;
  return <PantryItemCard pantryItemRef={item} />;
};

/** Row 0 is the sticky filter tabs; every other row is an item. */
export type PantryListItem = StickyHeaderSentinel | PantryListNode;

/**
 * Module scope so its identity never changes: `ViewHolder` in flash-list 2.3.2
 * memo-compares `renderItem` by reference, so an inline renderer re-renders
 * every mounted cell when anything it closes over changes. This closes over
 * nothing — the sticky tabs read `PantryStickyTabsProvider` instead.
 */
export const renderPantryListItem = (
  info: ListRenderItemInfo<PantryListItem>,
) => {
  const { item, target } = info;
  if (isStickyHeaderSentinel(item)) {
    return <PantryStickyTabs pinned={target === 'StickyHeader'} />;
  }
  return renderItem({ ...info, item });
};

export const getPantryListItemType = (item: PantryListItem) =>
  isStickyHeaderSentinel(item) ? 'stickyHeader' : 'item';

export const pantryListKeyExtractor = (item: PantryListItem) =>
  isStickyHeaderSentinel(item) ? '__stickyHeader__' : item.id;
