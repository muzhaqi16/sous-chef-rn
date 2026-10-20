import React from 'react';
import type { ListRenderItemInfo } from '@shopify/flash-list';
import { PantryItemCard } from '../PantryItemCard';
import type { PantryListItemNode } from '#features/pantry/hooks/usePantryQuery';

/** The `GetPantry` node shape: the direct fields the screen-level hooks read. */
export type PantryListNode = PantryListItemNode;

/**
 * Module scope so its identity never changes: `ViewHolder` in flash-list 2.3.2
 * memo-compares `renderItem` by reference, so an inline renderer re-renders
 * every mounted cell when anything it closes over changes. Each leaf owns its
 * cache subscription via useFragment.
 */
export const renderItem = ({ item }: ListRenderItemInfo<PantryListNode>) => (
  <PantryItemCard pantryItemId={item.id} />
);

export const pantryListKeyExtractor = (item: PantryListNode) => item.id;
