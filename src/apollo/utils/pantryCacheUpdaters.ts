/**
 * Cache updaters for the `Pantry.itemsConnection` edge list.
 *
 * Shared rather than feature-owned because three features and two shared
 * modals write to this connection — `features/pantry`, `features/barcode`,
 * `components/modals/AddToPantrySheet` and `screens/onBoarding`. They lived in
 * two places before this file: `hooks/home/pantry/utils.ts` and
 * `features/pantry/hooks/mutations/utils.ts` each declared their own
 * `addToPantryItemsCache` from the same factory with the same three arguments,
 * so the two could drift into writing the same connection differently.
 *
 * Sits beside `shoppingListCacheUpdaters.ts`, which is the same thing for the
 * shopping list, and next to the factory both are built from.
 */
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from './cacheUpdaters';

export const addToPantryItemsCache = createAddToParentConnectionUpdater<{
  id: string;
}>('Pantry', 'itemsConnection', 'PantryItem');

export const removeFromPantryItemsCache =
  createRemoveFromParentConnectionUpdater(
    'Pantry',
    'itemsConnection',
    'PantryItem',
  );
