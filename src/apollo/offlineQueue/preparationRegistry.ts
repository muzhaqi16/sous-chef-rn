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
  UpdateShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { BarcodeAddItemToShoppingListDocument } from '#features/barcode/hooks/useAddScannedItem.generated';
import {
  asQueued,
  withCurrentUnits,
  type ReplayPreparer,
} from './replayPreparation';

/**
 * Operations the queue replays without a `localFirst` opt-in, with what each
 * restates. Not a manifest field: i18n iterates the static registry on the
 * LAUNCH PATH, which would pull these in (`launchPathWeight.test.ts`).
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
    [RemoveItemFromShoppingListDocument, asQueued],
    [MoveShoppingListItemDocument, asQueued],
  ]);
