import { useState } from 'react';
import { useTranslation } from '#/i18n';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import {
  CreateShoppingListItemsFromRecipeDocument,
  CreateShoppingListItemFromRecipeIngredientDocument,
} from '#features/recipes/graphql/recipe.generated';
import {
  type MaterializedRecipe,
  type DisplayIngredient,
} from './useRecipeData';
import {
  AddItemsToShoppingListFromRecipeDocument,
  GetShoppingListsLiteDocument,
  CreateShoppingListDocument,
} from './useRecipeDetail.generated';
import { type BatchAddShoppingListItemInput } from '#/graphql/generated/schemaTypes';
import { useAppStore, useSelectedShoppingListId } from '#store/useAppStore';
import { extractNodes } from '#/utils/connectionUtils';
import { addNewItemToShoppingListCache } from '#/apollo/utils/shoppingListCacheUpdaters';
import { createAddToQueryConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { toastService } from '#/services/toastService';
import type { RecipeInformation } from '#/services/recipeApi/types';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { generateEntityId } from '#/utils/generateEntityId';
import {
  addOptimisticShoppingListItem,
  createOptimisticShoppingListItem,
  revertOptimisticShoppingListItem,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { logger } from '#/utils/environment';
import { stripPriceFromName } from '#/utils/stripPriceFromName';
import { errorService } from '#/services/errorService';
import type {
  AddItemsToShoppingListInput,
  CreateShoppingListItemFromRecipeIngredientInput,
} from '#/graphql/generated/schemaTypes';

interface UseRecipeShoppingListOptions {
  recipeId: string | undefined;
  isBackendRecipe: boolean;
  backendRecipe: MaterializedRecipe | null | undefined;
  externalRecipe: RecipeInformation | null;
}

type PendingAction = { type: 'all' };

/**
 * Fires the right add-ingredient mutation and reports whether the item landed.
 *
 * Module-level rather than inline in the hook because its body is full of
 * `||` / `?.` / ternaries, and the React Compiler bails out of the whole hook
 * when a value block appears inside a try/catch. The caller invokes it from
 * inside its try, so the catch still covers it.
 * See scripts/probe-compiler-try-forms.mjs.
 */
async function addIngredientToList(
  ingredient: DisplayIngredient,
  shoppingListId: string,
  deps: {
    isBackendRecipe: boolean;
    // Typed with the generated input shapes so the mutate functions from
    // `useMutation()` are assignable as-is.
    addRecipeIngredientMutation(options: {
      variables: { input: CreateShoppingListItemFromRecipeIngredientInput };
      context: { localFirst: boolean };
    }): Promise<{ data?: unknown; error?: unknown }>;
    addItemsToShoppingListMutation(options: {
      variables: { input: AddItemsToShoppingListInput };
      context: { localFirst: boolean };
    }): Promise<{ data?: unknown; error?: unknown }>;
    onRejected: () => void;
    /** Write the row into the cache before firing, so it survives being queued. */
    writeOptimisticRow(
      rowId: string,
      fields: {
        itemName: string;
        quantity: number | null;
        unitName: string | null;
        itemId?: string;
      },
    ): void;
    /** Take the row back when the server refuses it. */
    revertOptimisticRow(rowId: string): void;
  },
): Promise<boolean> {
  const {
    isBackendRecipe,
    addRecipeIngredientMutation,
    addItemsToShoppingListMutation,
    onRejected,
    writeOptimisticRow,
    revertOptimisticRow,
  } = deps;

  if (isBackendRecipe) {
    // Generate the new item's id so a create that gets queued (offline /
    // API down) replays idempotently, keyed by this id.
    const rowId = generateEntityId();
    // `in` narrows the DisplayIngredient union; the backend shape carries the
    // display fields the row needs, so it can be shown before the server
    // answers rather than only once `update:` runs (which never happens
    // offline).
    const unit = 'unit' in ingredient ? ingredient.unit : null;
    const linkedItem = 'item' in ingredient ? ingredient.item : null;
    writeOptimisticRow(rowId, {
      itemName: ingredient.name || 'Unknown ingredient',
      quantity:
        'quantity' in ingredient && typeof ingredient.quantity === 'number'
          ? ingredient.quantity
          : null,
      unitName:
        typeof unit === 'string' ? unit : unit?.symbol || unit?.name || null,
      itemId: linkedItem?.id,
    });

    const result = await addRecipeIngredientMutation({
      variables: {
        input: {
          id: rowId,
          recipeIngredientId: String(ingredient.id),
          shoppingListId,
        },
      },
      context: { localFirst: true },
    });

    // This mutation has no onError, so a resolved error-union payload or a
    // transport error would otherwise fall through to the success toast.
    // Classify and report once on rejection; 'created'/'queued' confirm.
    if (classifyCreateResult(result) === 'rejected') {
      revertOptimisticRow(rowId);
      onRejected();
      return false;
    }
    return true;
  }

  if ('amount' in ingredient) {
    // Single ingredient goes through the same batch mutation as a
    // one-element `items` array — there is no separate single-add op.
    const rowId = generateEntityId();
    const itemName = stripPriceFromName(
      ingredient.name || ingredient.original || 'Unknown ingredient',
    );
    const unitName =
      ingredient.measures?.us?.unitShort ||
      ingredient.measures?.metric?.unitShort ||
      undefined;

    writeOptimisticRow(rowId, {
      itemName,
      quantity: ingredient.amount || 0,
      unitName: unitName ?? null,
    });

    const result = await addItemsToShoppingListMutation({
      variables: {
        input: {
          shoppingListId,
          items: [
            {
              id: rowId,
              item: { itemName },
              quantity: ingredient.amount || 0,
              unit: { unitName },
              storePrefs: ingredient.aisle
                ? { aisle: ingredient.aisle }
                : undefined,
            },
          ],
        },
      },
      context: { localFirst: true },
    });

    // A resolved error-union payload or a transport error must not fall
    // through to the success toast. Classify: 'created'/'queued' confirm;
    // 'rejected' reports and returns. The mutation's onError already
    // toasts on a transport error, so toast here only for the resolved
    // error-union case — exactly one toast either way.
    if (classifyCreateResult(result) === 'rejected') {
      revertOptimisticRow(rowId);
      if (!result.error) onRejected();
      return false;
    }
  }

  return true;
}

export function useRecipeShoppingList({
  recipeId,
  isBackendRecipe,
  backendRecipe,
  externalRecipe,
}: UseRecipeShoppingListOptions) {
  const { t } = useTranslation();
  const { data: shoppingListsData, loading: shoppingListsLoading } = useQuery(
    GetShoppingListsLiteDocument,
    {},
  );
  const shoppingLists = extractNodes(shoppingListsData?.shoppingLists);

  const selectedShoppingListId = useSelectedShoppingListId();
  const setSelectedShoppingListId = useAppStore(
    state => state.setSelectedShoppingListId,
  );

  // Priority: user's selected list > default list > first list.
  const getTargetShoppingList = () => {
    if (shoppingLists.length === 0) return null;
    if (selectedShoppingListId) {
      const selected = shoppingLists.find(l => l.id === selectedShoppingListId);
      if (selected) return selected;
    }
    const defaultList = shoppingLists.find(list => list.isDefault);
    return defaultList ?? shoppingLists[0];
  };

  const getShoppingListById = (listId: string) =>
    shoppingLists.find(list => list.id === listId) || null;

  const client = useApolloClient();

  // State
  const [addingToList, setAddingToList] = useState(false);
  const [addedIngredients, setAddedIngredients] = useState<
    Set<string | number>
  >(new Set());
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [creatingList, setCreatingList] = useState(false);

  // The list picker is the only sheet — driven by `visible` through
  // useStandardBottomSheet's guarded path.
  const [listPickerVisible, setListPickerVisible] = useState(false);

  const openListPicker = (action: PendingAction) => {
    if (shoppingListsLoading) {
      toastService.info(t('recipes.loadingShoppingLists'));
      return;
    }
    setPendingAction(action);
    setListPickerVisible(true);
  };

  // Mutations
  const addToShoppingListsCache = createAddToQueryConnectionUpdater(
    'shoppingLists',
    'ShoppingList',
  );
  const [createShoppingListMutation] = useMutation(CreateShoppingListDocument, {
    update(cache, { data }) {
      const payload = data?.createShoppingList;
      if (payload?.__typename === 'CreateShoppingListPayload') {
        addToShoppingListsCache(cache, payload.shoppingList);
      }
    },
    onError: () => {
      toastService.error(t('errors.createListFailed'));
    },
  });

  const [createShoppingListItemsFromRecipeMutation] = useMutation(
    CreateShoppingListItemsFromRecipeDocument,
    {
      update: (cache, { data }, { variables }) => {
        const payload = data?.createShoppingListItemsFromRecipe;
        if (
          payload?.__typename !== 'CreateShoppingListItemsFromRecipePayload' ||
          !variables
        )
          return;
        try {
          const shoppingListId = variables.input.shoppingListId;
          payload.addedItems.forEach(item => {
            addNewItemToShoppingListCache(cache, shoppingListId, item);
          });
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Cache update failed for addRecipeToShoppingList:',
          });
        }
      },
      onError: err => {
        logger.error('Add recipe to shopping list error:', err);
        const errorMessage =
          err.message || t('recipes.addIngredientsToListFailed');
        toastService.error(
          t('recipes.couldNotAddIngredients', { error: errorMessage }),
        );
      },
    },
  );

  const [addRecipeIngredientMutation] = useMutation(
    CreateShoppingListItemFromRecipeIngredientDocument,
    {
      update: (cache, { data }, { variables }) => {
        const response = data?.createShoppingListItemFromRecipeIngredient;
        if (
          response?.__typename !==
            'CreateShoppingListItemFromRecipeIngredientPayload' ||
          !variables
        )
          return;
        try {
          const shoppingListId = variables.input.shoppingListId;
          if (!response.wasUpdated) {
            addNewItemToShoppingListCache(
              cache,
              shoppingListId,
              response.shoppingListItem,
            );
          }
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Cache update failed for addRecipeIngredient:',
          });
        }
      },
    },
  );

  const [addItemsToShoppingListMutation] = useMutation(
    AddItemsToShoppingListFromRecipeDocument,
    {
      update: (cache, { data }, { variables }) => {
        const payload = data?.addItemsToShoppingList;
        if (
          payload?.__typename !== 'AddItemsToShoppingListPayload' ||
          !variables
        )
          return;
        const shoppingListId = variables.input.shoppingListId;
        // Filtered before the try — a `&&` inside a try body makes the React
        // Compiler bail out of this hook.
        const addedItems = payload.results.flatMap(result =>
          result.success && result.item ? [result.item] : [],
        );
        try {
          addedItems.forEach(item =>
            addNewItemToShoppingListCache(cache, shoppingListId, item),
          );
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Cache update failed for addItemsToShoppingList:',
          });
        }
      },
      onError: err => {
        logger.error('Batch add items to shopping list error:', err);
        const errorMessage =
          err.message || t('recipes.addIngredientsToListFailed');
        toastService.error(
          t('recipes.couldNotAddIngredients', { error: errorMessage }),
        );
      },
    },
  );

  // Add a single ingredient to the user's default/selected list (no picker).
  const handleAddSingleIngredient = async (ingredient: DisplayIngredient) => {
    const targetList = getTargetShoppingList();
    if (!targetList) {
      toastService.error(t('recipes.createListFirst'));
      return;
    }

    try {
      const listId = targetList.id;
      const added = await addIngredientToList(ingredient, listId, {
        isBackendRecipe,
        addRecipeIngredientMutation,
        addItemsToShoppingListMutation,
        onRejected: () =>
          toastService.error(t('recipes.addIngredientToListFailed')),
        // Written before the mutation fires so the row shows immediately and
        // survives being queued — the `update:` callbacks only run with a
        // server payload, so offline they never fire.
        writeOptimisticRow: (rowId, fields) => {
          const row = createOptimisticShoppingListItem(rowId, {
            itemName: fields.itemName,
            quantity: fields.quantity,
            quantityInput: null,
            unitName: fields.unitName,
            category: null,
            itemId: fields.itemId,
            unitId: undefined,
          });
          try {
            addOptimisticShoppingListItem(client.cache, listId, row);
          } catch (cacheError) {
            errorService.reportError(cacheError, {
              operation: 'Add recipe ingredient (optimistic)',
            });
          }
        },
        revertOptimisticRow: rowId =>
          revertOptimisticShoppingListItem(client.cache, listId, rowId),
      });
      if (!added) return;

      setAddedIngredients(prev => new Set(prev).add(ingredient.id));
      toastService.success(
        t('recipes.addedToList', { listName: targetList.name }),
      );
    } catch (err) {
      logger.error('Failed to add ingredient:', err);
      toastService.error(t('recipes.addIngredientToListFailed'));
    }
  };

  // Adds all ingredients to the picked list. Called after the list picker
  // resolves. `listName` may be passed for newly-created lists not yet in
  // the local array.
  const addAllIngredientsToList = (listId: string, listName?: string) => {
    const resolvedName = listName ?? getShoppingListById(listId)?.name;
    if (!resolvedName) {
      toastService.error(t('recipes.shoppingListNotFound'));
      return;
    }

    executeWithLoadingState(
      async () => {
        if (isBackendRecipe && backendRecipe && recipeId) {
          const result = await createShoppingListItemsFromRecipeMutation({
            variables: {
              input: {
                recipeId,
                shoppingListId: listId,
                servings: backendRecipe.servings,
              },
            },
          });

          const payload = result.data?.createShoppingListItemsFromRecipe;
          if (
            payload?.__typename === 'CreateShoppingListItemsFromRecipePayload'
          ) {
            const data = payload;
            const allIngredientIds = extractNodes(
              backendRecipe.ingredientsConnection,
            ).map(ing => ing.id);
            setAddedIngredients(prev => {
              const next = new Set(prev);
              allIngredientIds.forEach(id => next.add(id));
              return next;
            });
            toastService.success(
              data.totalUpdated > 0
                ? t('recipes.addedItemsToListUpdated', {
                    count: data.totalAdded,
                    listName: resolvedName,
                    updated: data.totalUpdated,
                  })
                : t('recipes.addedItemsToList', {
                    count: data.totalAdded,
                    listName: resolvedName,
                  }),
            );
          }
        } else if (externalRecipe?.extendedIngredients) {
          const items: BatchAddShoppingListItemInput[] =
            externalRecipe.extendedIngredients.map((ingredient, index) => ({
              // `id` is the row's primary key (so a queued batch replays
              // idempotently); `clientId` stays the ingredient index used below
              // to match each result back to its ingredient.
              id: generateEntityId(),
              clientId: String(ingredient.id || index),
              item: {
                itemName: stripPriceFromName(
                  ingredient.name ||
                    ingredient.original ||
                    'Unknown ingredient',
                ),
              },
              quantity: ingredient.amount || 0,
              unit: {
                unitName:
                  ingredient.measures?.us?.unitShort ||
                  ingredient.measures?.metric?.unitShort ||
                  '',
              },
              storePrefs: ingredient.aisle
                ? { aisle: ingredient.aisle }
                : undefined,
            }));

          // Write the rows before firing. The `update` callback only runs with
          // a server payload, so offline it never fires: the recipe reported
          // success and marked its checkmarks while the shopping list stayed
          // empty. The client mints each `id`, so when the batch does replay the
          // server response merges onto these same entities rather than
          // duplicating them.
          items.forEach(batchItem => {
            const rowId = batchItem.id;
            if (!rowId) return;
            // Value blocks (`?.`, `??`, ternary) must stay OUT of the try —
            // inside one they bail this whole hook out of the React Compiler.
            const unitName = batchItem.unit?.unitName ?? null;
            const quantity =
              typeof batchItem.quantity === 'number'
                ? batchItem.quantity
                : null;
            const itemName = batchItem.item.itemName ?? '';
            const optimisticRow = createOptimisticShoppingListItem(rowId, {
              itemName,
              quantity,
              quantityInput: null,
              unitName,
              category: null,
              itemId: undefined,
              unitId: undefined,
            });
            try {
              addOptimisticShoppingListItem(
                client.cache,
                listId,
                optimisticRow,
              );
            } catch (cacheError) {
              errorService.reportError(cacheError, {
                operation: 'Add recipe ingredients (optimistic)',
              });
            }
          });

          const result = await addItemsToShoppingListMutation({
            variables: {
              input: {
                shoppingListId: listId,
                items,
              },
            },
            context: { localFirst: true },
          });

          // A refusal resolves under errorPolicy:'all' with no thrown error, so
          // the rows have to be taken back explicitly or they linger until the
          // next refetch. A QUEUED batch (no data, no error) is not a refusal —
          // it keeps its rows and replays.
          if (classifyCreateResult(result) === 'rejected') {
            items.forEach(batchItem => {
              if (batchItem.id) {
                revertOptimisticShoppingListItem(
                  client.cache,
                  listId,
                  batchItem.id,
                );
              }
            });
          }

          const payload = result.data?.addItemsToShoppingList;
          if (payload?.__typename === 'AddItemsToShoppingListPayload') {
            const data = payload;
            const successfullyAddedIds = data.results
              .filter(r => r.success)
              .map(r => Number(r.clientId));
            setAddedIngredients(prev => {
              const next = new Set(prev);
              successfullyAddedIds.forEach(id => next.add(id));
              return next;
            });
            toastService.success(
              data.summary.skipped > 0
                ? t('recipes.addedItemsToListUpdated', {
                    count: data.summary.succeeded,
                    listName: resolvedName,
                    updated: data.summary.skipped,
                  })
                : t('recipes.addedItemsToList', {
                    count: data.summary.succeeded,
                    listName: resolvedName,
                  }),
            );
          } else if (!result.error) {
            // No data and no error → the batch was queued while offline / the API
            // was unreachable. The items replay later; mark them all added and
            // confirm so the recipe reflects the request.
            setAddedIngredients(prev => {
              const next = new Set(prev);
              externalRecipe.extendedIngredients.forEach(ing =>
                next.add(ing.id),
              );
              return next;
            });
            toastService.success(
              t('recipes.addedItemsToList', {
                count: items.length,
                listName: resolvedName,
              }),
            );
          }
        } else {
          toastService.error(t('recipes.noIngredientsToAdd'));
        }
      },
      setAddingToList,
      err => {
        logger.error('Failed to add ingredients:', err);
        toastService.error(t('recipes.addIngredientsToListFailed'));
      },
    );
  };

  // Entry point from the recipe ingredient list "Add All" button.
  const handleAddAll = () => {
    openListPicker({ type: 'all' });
  };

  const handleListSelected = (listId: string) => {
    setListPickerVisible(false);
    if (pendingAction?.type === 'all') {
      addAllIngredientsToList(listId);
    }
    setPendingAction(null);
  };

  // Create a new shopping list and route the pending action into it.
  const handleCreateListAndAddIngredients = (name: string) => {
    if (!name.trim()) {
      toastService.error(t('errors.listNameEmpty'));
      return;
    }

    const currentPendingAction = pendingAction;

    executeWithLoadingState(
      async () => {
        const result = await createShoppingListMutation({
          variables: {
            input: {
              name: name.trim(),
              description: 'Created from recipe',
              isDefault: false,
              tags: ['recipe-created'],
            },
          },
        });

        const createPayload = result.data?.createShoppingList;
        if (createPayload?.__typename !== 'CreateShoppingListPayload') {
          toastService.error(t('errors.createShoppingListFailed'));
          return;
        }
        const newList = createPayload.shoppingList;

        setSelectedShoppingListId(newList.id);
        setListPickerVisible(false);

        if (currentPendingAction?.type === 'all') {
          addAllIngredientsToList(newList.id, newList.name);
        }
        setPendingAction(null);
      },
      setCreatingList,
      err => {
        logger.error('Failed to create list and add ingredients:', err);
        toastService.error(t('errors.createShoppingListFailed'));
      },
    );
  };

  // List picker dismissed (selection, swipe, or blur) — sync visibility state.
  const handleSheetDismiss = () => {
    setListPickerVisible(false);
  };

  return {
    shoppingLists,
    addingToList,
    addedIngredients,
    creatingList,

    handleAddSingleIngredient,
    handleAddAll,
    handleListSelected,
    handleCreateListAndAddIngredients,
    handleSheetDismiss,

    listPickerVisible,
  };
}
