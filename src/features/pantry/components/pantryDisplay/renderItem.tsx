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

/** Row 0 is the sticky filter tabs; every other row is an item. */
export type PantryListItem = StickyHeaderSentinel | PantryListNode;

/**
 * The pantry list's renderer, at module scope so its identity never changes.
 *
 * That matters more than it looks: `ViewHolder` in the installed
 * `@shopify/flash-list@2.3.2` memo-compares `renderItem` by reference
 * alongside `extraData`, so an inline renderer re-renders every mounted cell
 * whenever anything it closes over changes. This one closes over nothing — the
 * sticky tabs read their state from `PantryStickyTabsProvider` instead.
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
