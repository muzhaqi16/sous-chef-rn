import type { SyncBuilderTable } from './syncBuilder';
import { byOperation } from '#/apollo/utils/documentOperation';
import {
  buildDeletePantryItemSync,
  buildPantryItemQuantitySync,
  buildPantryItemSync,
} from '#features/pantry/offline/syncBuilders';
import {
  buildDeleteShoppingItemSync,
  buildMoveShoppingItemSync,
  buildShoppingItemSync,
} from '#features/shoppingList/offline/syncBuilders';
import {
  CreatePantryItemDocument,
  DeletePantryItemDocument,
  UpdatePantryItemDocument,
  UpdatePantryItemQuantityDocument,
} from '#features/pantry/graphql/pantry.generated';
import { AddItemToShoppingListFromFilteredPantryDocument } from '#features/pantry/screens/FilteredPantryItems.generated';
import { AddItemToShoppingListFromPantryItemDocument } from '#features/pantry/screens/PantryItemDetail.generated';
import {
  AddItemToShoppingListDocument,
  MoveShoppingListItemDocument,
  RemoveItemFromShoppingListDocument,
  ToggleShoppingListItemPurchasedDocument,
  UpdateShoppingListItemDocument,
  UpdateShoppingListItemQuantityDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  BarcodeAddItemToShoppingListDocument,
  BarcodeCreatePantryItemDocument,
} from '#features/barcode/hooks/useAddScannedItem.generated';

/**
 * Every operation that can replay through a `Sync*` upsert, keyed by the name
 * its document declares. Deliberately its own list, not a manifest field: i18n
 * iterates the static registry on the LAUNCH PATH, so a manifest carrying these
 * would pull the queue's builders into it (`launchPathWeight.test.ts`).
 * Per-feature copies of one mutation share its builder. The granular pantry
 * deltas have no entry: they replay as themselves, made at-most-once by
 * `input.idempotencyKey`.
 */
export const SYNC_REGISTRY: SyncBuilderTable = byOperation([
  [CreatePantryItemDocument, buildPantryItemSync],
  [BarcodeCreatePantryItemDocument, buildPantryItemSync],
  [UpdatePantryItemDocument, buildPantryItemSync],
  [UpdatePantryItemQuantityDocument, buildPantryItemQuantitySync],
  [DeletePantryItemDocument, buildDeletePantryItemSync],
  [AddItemToShoppingListDocument, buildShoppingItemSync],
  [BarcodeAddItemToShoppingListDocument, buildShoppingItemSync],
  [AddItemToShoppingListFromFilteredPantryDocument, buildShoppingItemSync],
  [AddItemToShoppingListFromPantryItemDocument, buildShoppingItemSync],
  [UpdateShoppingListItemDocument, buildShoppingItemSync],
  [UpdateShoppingListItemQuantityDocument, buildShoppingItemSync],
  [ToggleShoppingListItemPurchasedDocument, buildShoppingItemSync],
  [RemoveItemFromShoppingListDocument, buildDeleteShoppingItemSync],
  [MoveShoppingListItemDocument, buildMoveShoppingItemSync],
]);
