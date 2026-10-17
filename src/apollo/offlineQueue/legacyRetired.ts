import type { OperationVariables } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { isRecord } from '#/utils/isRecord';
import { isOwnKey } from '#/utils/isOwnKey';
import {
  ConvertExpiredToWasteDocument,
  CreatePantryItemDocument,
  RestockPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import { MarkRecipeAsCookedDocument } from '#features/recipes/graphql/recipe.generated';
import { UpdateShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { text, type Input } from './legacyRefs';

/**
 * A write queued by a build that sent an operation the API has since removed.
 * Its stored document fails validation, so the write the user already saw
 * applied would be refused for its shape and withdrawn. Each entry is rewritten
 * once, on load, into the operation that replaced it, carrying the same
 * subject, ids and amounts.
 */

export interface UpgradedEntry {
  operationName: string;
  mutation: DocumentNode;
  variables: OperationVariables;
}

interface Replacement {
  document: DocumentNode;
  input: (stored: Input) => Input;
}

type RetiredOperation =
  | 'ToggleShoppingListItemPurchased'
  | 'UpdateShoppingListItemQuantity'
  | 'ConfirmRecipeConsumption'
  | 'ConvertExpiredBatchesToWaste';

type FoldedOperation = 'BarcodeCreatePantryItem' | 'BarcodeRestockPantryItem';

/** One reviewed-cook line as the cook's `ingredientsUsed` entry. */
const usageEntry = (line: unknown): Input[] =>
  isRecord(line)
    ? [
        {
          recipeIngredientId: line.recipeIngredientId,
          pantryItemId: line.pantryItemId,
          actualQuantity: line.quantity,
          actualUnitId: line.unitId,
        },
      ]
    : [];

const RETIRED: Record<RetiredOperation, Replacement> = {
  // The tick stored no version. The server does not hold an update carrying
  // only `purchaseTracking` to one, so 0 is applied whatever the row is at.
  ToggleShoppingListItemPurchased: {
    document: UpdateShoppingListItemDocument,
    input: stored => ({
      id: stored.id,
      version: 0,
      purchaseTracking: { isPurchased: stored.purchased === true },
    }),
  },
  UpdateShoppingListItemQuantity: {
    document: UpdateShoppingListItemDocument,
    input: stored => {
      const unitId = text(stored.unitId);
      return {
        id: stored.itemId,
        version: stored.version,
        quantity: stored.quantity,
        ...(unitId && { unit: { id: unitId } }),
      };
    },
  },
  // One write for the whole reviewed cook: every stack it named, or none.
  ConfirmRecipeConsumption: {
    document: MarkRecipeAsCookedDocument,
    input: stored => ({
      id: stored.id,
      recipeId: stored.recipeId,
      pantryId: stored.pantryId,
      deductFromPantry: true,
      exactStacks: true,
      ingredientsUsed: Array.isArray(stored.consumptions)
        ? stored.consumptions.flatMap(usageEntry)
        : [],
      ...(stored.servings != null && { servings: stored.servings }),
      ...(stored.notes != null && { notes: stored.notes }),
    }),
  },
  // The stored input already carries the day of the tap in `today`.
  ConvertExpiredBatchesToWaste: {
    document: ConvertExpiredToWasteDocument,
    input: stored => stored,
  },
};

/**
 * A feature's own copy of a mutation that a later build folded into the
 * canonical one, by the name it replays under now. The registries key on the
 * name and an entry replays its own stored document, so only the name moves.
 */
const FOLDED: Record<FoldedOperation, string> = {
  BarcodeCreatePantryItem: operationNameOf(CreatePantryItemDocument),
  BarcodeRestockPantryItem: operationNameOf(RestockPantryItemDocument),
};

/** A stored entry as this build replays it; itself when nothing about it moved. */
export function upgradeRetiredEntry(entry: UpgradedEntry): UpgradedEntry {
  const { operationName, variables } = entry;
  if (isOwnKey(FOLDED, operationName)) {
    return { ...entry, operationName: FOLDED[operationName] };
  }
  const input: unknown = variables.input;
  if (!isOwnKey(RETIRED, operationName) || !isRecord(input)) return entry;
  const { document, input: toCurrent } = RETIRED[operationName];
  return {
    operationName: operationNameOf(document),
    mutation: document,
    variables: { ...variables, input: toCurrent(input) },
  };
}
