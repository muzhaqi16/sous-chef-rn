import type { DocumentNode } from 'graphql';
import { inputTypeNameOf } from '#/apollo/utils/documentOperation';
import type {
  AddItemsToShoppingListInput,
  ConvertExpiredBatchesToWasteInput,
  ConvertExpiredToWasteInput,
  CreatePantryItemUsageInput,
  ForkRecipeInput,
  MoveShoppingItemToPantryInput,
  MoveShoppingListItemInput,
  OpenPantryItemBatchInput,
  RemoveRecipeFromFavoritesInput,
  UpdatePantryItemQuantityInput,
  UpdateRecipeIngredientsInput,
  UpdateShoppingListItemQuantityInput,
  WastePantryItemBatchInput,
} from '#/graphql/generated/schemaTypes';
import type { QueuedMutation } from './types';

/** The input types whose subject is a field other than `id`. */
interface SubjectInputs {
  AddItemsToShoppingListInput: AddItemsToShoppingListInput;
  ConvertExpiredBatchesToWasteInput: ConvertExpiredBatchesToWasteInput;
  ConvertExpiredToWasteInput: ConvertExpiredToWasteInput;
  CreatePantryItemUsageInput: CreatePantryItemUsageInput;
  ForkRecipeInput: ForkRecipeInput;
  MoveShoppingItemToPantryInput: MoveShoppingItemToPantryInput;
  MoveShoppingListItemInput: MoveShoppingListItemInput;
  OpenPantryItemBatchInput: OpenPantryItemBatchInput;
  RemoveRecipeFromFavoritesInput: RemoveRecipeFromFavoritesInput;
  UpdatePantryItemQuantityInput: UpdatePantryItemQuantityInput;
  UpdateRecipeIngredientsInput: UpdateRecipeIngredientsInput;
  UpdateShoppingListItemQuantityInput: UpdateShoppingListItemQuantityInput;
  WastePantryItemBatchInput: WastePantryItemBatchInput;
}

/**
 * The field naming the entity a write creates or changes, per input type;
 * anything unlisted is `id`. Typed over the codegen inputs, so a field the API
 * renames fails typecheck. `ForkRecipeInput.id` is the SOURCE recipe.
 * `UpdateFavoriteRecipeInput` stays unlisted: its edit lands on a SavedRecipe
 * the input never names, and `recipeId` is only the recipe it hangs off.
 */
const SUBJECT_KEYS: {
  readonly [K in keyof SubjectInputs]: keyof SubjectInputs[K] & string;
} = {
  AddItemsToShoppingListInput: 'items',
  ConvertExpiredBatchesToWasteInput: 'pantryItemId',
  ConvertExpiredToWasteInput: 'pantryItemId',
  CreatePantryItemUsageInput: 'pantryItemId',
  ForkRecipeInput: 'newRecipeId',
  MoveShoppingItemToPantryInput: 'pantryItemId',
  MoveShoppingListItemInput: 'itemId',
  OpenPantryItemBatchInput: 'batchId',
  RemoveRecipeFromFavoritesInput: 'recipeId',
  UpdatePantryItemQuantityInput: 'pantryItemId',
  UpdateRecipeIngredientsInput: 'recipeId',
  UpdateShoppingListItemQuantityInput: 'itemId',
  WastePantryItemBatchInput: 'batchId',
};

export interface QueuedSubject {
  /** What the write creates or changes: its withdrawal target and pending ids. */
  subjectIds: string[];
  /** What the write is derived from: a dependency, never a target. */
  sourceIds: string[];
}

const isSubjectInput = (name: string): name is keyof SubjectInputs =>
  name in SUBJECT_KEYS;

const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Reads a queued write's subject from the input type its document declares.
 * `variables` is optional because an entry is read back from persisted JSON.
 */
export function queuedSubject({
  mutation,
  variables,
}: {
  mutation: DocumentNode;
  variables?: QueuedMutation['variables'];
}): QueuedSubject {
  const fields: unknown = variables?.input;
  if (!isRecord(fields)) {
    return { subjectIds: [], sourceIds: [] };
  }

  const typeName = inputTypeNameOf(mutation);
  const key =
    typeName && isSubjectInput(typeName) ? SUBJECT_KEYS[typeName] : 'id';
  const value = fields[key];

  const subjectIds = Array.isArray(value)
    ? value
        .map((row: unknown) =>
          row && typeof row === 'object'
            ? (row as { id?: unknown }).id
            : undefined,
        )
        .filter(isId)
    : [value].filter(isId);
  const sourceIds = key !== 'id' && isId(fields.id) ? [fields.id] : [];

  return { subjectIds, sourceIds };
}
