import { byOperation } from '#/apollo/utils/documentOperation';
import { preparePantryItemCreate } from '#features/pantry/offline/replayPreparers';
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
import { BarcodeAddItemToShoppingListDocument } from '#features/barcode/hooks/useAddScannedItem.generated';
import {
  asQueued,
  withCurrentUnits,
  type ReplayPreparer,
} from './replayPreparation';

/**
 * Every operation the queue replays without the caller's `localFirst` opt-in,
 * with what its replay restates, keyed by the name its document declares. Its
 * own list, not a manifest field: i18n iterates the static registry on the
 * LAUNCH PATH, so a manifest carrying these would pull them into it
 * (`launchPathWeight.test.ts`). Per-feature copies of one mutation share a
 * preparer.
 */
export const REPLAY_PREPARATIONS: Readonly<Record<string, ReplayPreparer>> =
  byOperation([
    [CreatePantryItemDocument, preparePantryItemCreate],
    [UpdatePantryItemDocument, withCurrentUnits],
    [UpdatePantryItemQuantityDocument, withCurrentUnits],
    [DeletePantryItemDocument, asQueued],
    [AddItemToShoppingListDocument, withCurrentUnits],
    [BarcodeAddItemToShoppingListDocument, withCurrentUnits],
    [AddItemToShoppingListFromFilteredPantryDocument, withCurrentUnits],
    [AddItemToShoppingListFromPantryItemDocument, withCurrentUnits],
    [UpdateShoppingListItemDocument, withCurrentUnits],
    [UpdateShoppingListItemQuantityDocument, withCurrentUnits],
    [ToggleShoppingListItemPurchasedDocument, asQueued],
    [RemoveItemFromShoppingListDocument, asQueued],
    [MoveShoppingListItemDocument, asQueued],
  ]);
