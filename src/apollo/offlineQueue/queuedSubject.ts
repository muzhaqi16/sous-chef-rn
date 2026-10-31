import type { DocumentNode } from 'graphql';
import { inputTypeNameOf } from '#/apollo/utils/documentOperation';
import type {
  AddItemsToShoppingListInput,
  ConvertExpiredToWasteInput,
  CreatePantryItemUsageInput,
  CreateReceiptCheckInInput,
  ForkRecipeInput,
  MoveShoppingItemToPantryInput,
  OpenPantryItemBatchInput,
  RemoveRecipeFromFavoritesInput,
  UpdatePantryItemQuantityInput,
  UpdateRecipeIngredientsInput,
  WastePantryItemBatchInput,
} from '#/graphql/generated/schemaTypes';
import type { QueuedMutation } from './types';
import { isRecord } from '#/utils/isRecord';

/** The input types whose subject is a field other than `id`. */
interface SubjectInputs {
  AddItemsToShoppingListInput: AddItemsToShoppingListInput;
  ConvertExpiredToWasteInput: ConvertExpiredToWasteInput;
  CreatePantryItemUsageInput: CreatePantryItemUsageInput;
  CreateReceiptCheckInInput: CreateReceiptCheckInInput;
  ForkRecipeInput: ForkRecipeInput;
  MoveShoppingItemToPantryInput: MoveShoppingItemToPantryInput;
  OpenPantryItemBatchInput: OpenPantryItemBatchInput;
  RemoveRecipeFromFavoritesInput: RemoveRecipeFromFavoritesInput;
  UpdatePantryItemQuantityInput: UpdatePantryItemQuantityInput;
  UpdateRecipeIngredientsInput: UpdateRecipeIngredientsInput;
  WastePantryItemBatchInput: WastePantryItemBatchInput;
}

/**
 * The field naming a write's subject, per input type; unlisted is `id`.
 * `ForkRecipeInput.id` is the SOURCE recipe. `UpdateFavoriteRecipeInput` stays
 * unlisted: it edits a SavedRecipe the input never names.
 */
const SUBJECT_KEYS: {
  readonly [K in keyof SubjectInputs]: keyof SubjectInputs[K] & string;
} = {
  AddItemsToShoppingListInput: 'items',
  ConvertExpiredToWasteInput: 'pantryItemId',
  CreatePantryItemUsageInput: 'pantryItemId',
  CreateReceiptCheckInInput: 'lines',
  ForkRecipeInput: 'newRecipeId',
  MoveShoppingItemToPantryInput: 'pantryItemId',
  OpenPantryItemBatchInput: 'batchId',
  RemoveRecipeFromFavoritesInput: 'recipeId',
  UpdatePantryItemQuantityInput: 'pantryItemId',
  UpdateRecipeIngredientsInput: 'recipeId',
  WastePantryItemBatchInput: 'batchId',
};

export interface QueuedSubject {
  /** What the write creates or changes: its withdrawal target and pending ids. */
  subjectIds: string[];
  /** What the write is derived from: a dependency, never a target. */
  sourceIds: string[];
  /** The subset of `subjectIds` minted on the device, which the server has never seen. */
  mintedIds: string[];
}

/** Inputs keyed by something other than `id` whose subject is minted by the device. */
const MINTING_SUBJECT_INPUTS: ReadonlySet<keyof SubjectInputs> = new Set([
  'AddItemsToShoppingListInput',
  'CreateReceiptCheckInInput',
  'ForkRecipeInput',
  'MoveShoppingItemToPantryInput',
]);

/**
 * The field naming each row's entity, for a subject that is a list of rows;
 * `id` otherwise. A check-in line names the stack it adds, which a stock-free
 * line has none of.
 */
const ROW_SUBJECT_KEYS: Partial<Record<keyof SubjectInputs, string>> = {
  CreateReceiptCheckInInput: 'pantryItemId',
};

/** `id`-keyed inputs outside the `Create*` names whose `id` the device mints. */
const MINTING_ID_INPUTS: ReadonlySet<string> = new Set([
  'AddBrandToListInput',
  'AddRecipeToFavoritesInput',
  'AddRestrictionInput',
  'AddTemplateItemInput',
]);

/**
 * `Create*Input.id` is the device's cuid; an update's `id` and a usage's
 * `pantryItemId` name a row the server already owns.
 */
const mintsItsSubject = (typeName: string | null, key: string): boolean =>
  typeName !== null &&
  (isSubjectInput(typeName)
    ? MINTING_SUBJECT_INPUTS.has(typeName)
    : key === 'id' &&
      (typeName.startsWith('Create') || MINTING_ID_INPUTS.has(typeName)));

const isSubjectInput = (name: string): name is keyof SubjectInputs =>
  name in SUBJECT_KEYS;

const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

/** `RemoveItemFromShoppingListInput.id` is the row it deletes, as a `Delete*Input.id` is. */
const DELETING_INPUTS: ReadonlySet<string> = new Set([
  'RemoveItemFromShoppingListInput',
]);

/** Whether a queued write deletes the entity its subject names. */
export const deletesItsSubject = ({
  mutation,
}: {
  mutation: DocumentNode;
}): boolean => {
  const typeName = inputTypeNameOf(mutation);
  return (
    typeName !== null &&
    (typeName.startsWith('Delete') || DELETING_INPUTS.has(typeName))
  );
};

/** The API's name for a write of one entity: `Create|Update|Delete<Type>Input`. */
const ENTITY_WRITE_INPUT = /^(?:Create|Update|Delete)([A-Z][A-Za-z]*)Input$/;

/**
 * The type of the entity a write's `id` names, read off its input type: what to
 * call the write when the cache does not hold the row. Null for an input whose
 * subject is another field, or whose name states no type.
 */
export function subjectTypeOf({
  mutation,
}: {
  mutation: DocumentNode;
}): string | null {
  const typeName = inputTypeNameOf(mutation);
  if (!typeName || isSubjectInput(typeName)) return null;
  return ENTITY_WRITE_INPUT.exec(typeName)?.[1] ?? null;
}

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
    return { subjectIds: [], sourceIds: [], mintedIds: [] };
  }

  const typeName = inputTypeNameOf(mutation);
  const subjectInput = typeName && isSubjectInput(typeName) ? typeName : null;
  const key = subjectInput ? SUBJECT_KEYS[subjectInput] : 'id';
  const rowKey = (subjectInput && ROW_SUBJECT_KEYS[subjectInput]) ?? 'id';
  const value = fields[key];

  const subjectIds = Array.isArray(value)
    ? value
        .map((row: unknown) => (isRecord(row) ? row[rowKey] : undefined))
        .filter(isId)
    : [value].filter(isId);
  const sourceIds = key !== 'id' && isId(fields.id) ? [fields.id] : [];
  const mintedIds = mintsItsSubject(typeName ?? null, key) ? subjectIds : [];

  return { subjectIds, sourceIds, mintedIds };
}

/**
 * Input keys that name the PARENT a queued write attaches to. A deferred
 * parent holds these children back; the keys stay out of a write's
 * `subjectIds`, so a refused child never evicts its parent.
 */
export const PARENT_REFERENCE_KEYS: readonly string[] = [
  'homeId',
  'pantryId',
  'shoppingListId',
  'shoppingListItemId',
  'afterItemId',
  'beforeItemId',
  'storageLocationId',
  'parentLocationId',
  'mealPlanId',
  'mealPlanItemId',
  'templateId',
  'recipeIngredientId',
  'cookingLogId',
  'targetBatchId',
  'purchaseId',
  'recipeId',
  // A store a queued createStore may have minted.
  'storeId',
  'targetStoreId',
  'preferredStoreId',
  // A brand list a queued createBrandList may have minted.
  'brandListId',
];

/**
 * What a write waits on: the parents it attaches to at any depth (a batch
 * row, `meal.recipeId`, a purchase's `receipt.storeId`), and the entity it is
 * derived from (a fork's source recipe).
 */
export function dependencyIdsOf(write: {
  mutation: DocumentNode;
  variables?: QueuedMutation['variables'];
}): string[] {
  const ids = new Set<string>(queuedSubject(write).sourceIds);
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (!isRecord(value)) return;
    for (const key of PARENT_REFERENCE_KEYS) {
      const id = value[key];
      if (typeof id === 'string' && id) ids.add(id);
    }
    Object.values(value).forEach(collect);
  };
  collect(write.variables?.input);
  return [...ids];
}
