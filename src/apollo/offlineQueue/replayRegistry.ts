/**
 * Every feature that settles its own replay, keyed by the operation its
 * document declares. See {@link SYNC_REGISTRY} for why this is a list here
 * rather than a manifest field.
 */
import { byOperation } from '#/apollo/utils/documentOperation';
import { reconcileCreateHomeReplay } from '#features/home/offline/replayReconcilers';
import { reconcileMoveToPantryReplay } from '#features/pantry/offline/replayReconcilers';
import { CreateHomeDocument } from '#operations/home/home.generated';
import { reconcileShoppingBatchReplay } from '#features/shoppingList/offline/replayReconcilers';
import {
  AddItemToShoppingListDocument,
  MoveShoppingItemToPantryDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import type { ReplayReconcilerTable } from './types';

export const REPLAY_RECONCILERS: ReplayReconcilerTable = byOperation([
  [CreateHomeDocument, reconcileCreateHomeReplay],
  [MoveShoppingItemToPantryDocument, reconcileMoveToPantryReplay],
  [AddItemToShoppingListDocument, reconcileShoppingBatchReplay],
]);
