import { useState } from 'react';
import { useTranslation } from '#/i18n';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import {
  CreateShoppingListItemsFromRecipeDocument,
  CreateShoppingListItemFromRecipeIngredientDocument,
} from '#features/recipes/graphql/recipe.generated';
import type { MaterializedRecipe, DisplayIngredient } from './useRecipeData';
import {
  AddItemsToShoppingListFromRecipeDocument,
  GetShoppingListsLiteForRecipeDocument,
  CreateShoppingListForRecipeDocument,
} from './useRecipeDetail.generated';
import type { BatchAddShoppingListItemInput } from '#/graphql/generated/schemaTypes';
import { useAppStore, useSelectedShoppingListId } from '#store/useAppStore';
import { extractNodes } from '#/utils/connectionUtils';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { addNewItemToShoppingListCache } from '#features/shoppingList/cache/connections';
import { addShoppingListToQueryCache } from '#features/shoppingList/cache/list';
import {
  settleMutation,
  type SettledFailure,
} from '#/apollo/utils/settleMutation';
import { toastService } from '#/services/toastService';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import type { RecipeInformation } from '#/services/spoonacular/types';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { generateEntityId } from '#/utils/generateEntityId';
import {
  addOptimisticShoppingListItem,
  buildAddItemsReconcileUpdate,
  createOptimisticShoppingListItem,
  reconcileShoppingItemCreateUpdate,
  revertOptimisticShoppingListItem,
} from '#features/shoppingList/cache/items';
import { logger } from '#/utils/environment';
import { stripPriceFromName } from '#features/recipes/utils/stripPriceFromName';
import { preferredMeasure } from '#features/recipes/utils/preferredMeasure';
import { useAppSettings } from '#features/profile/hooks/useAppSettings';
import type { UnitSystem } from '#/graphql/generated/schemaTypes';
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
 * Fires the right add-ingredient mutation and resolves to the failure when the
 * item did not land. Module-level, not inline: its body is full of value blocks,
 * and one inside a try/catch bails the whole hook out of the React Compiler. The
 * caller still invokes it from inside its try.
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
    /** The caller's copy for a refused add. */
    fallback: string;
    /** The name a line takes when the ingredient carries none. */
    unnamedIngredient: string;
    /** The reader's system, so a line is bought in the units they think in. */
    unitSystem: UnitSystem;
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
): Promise<SettledFailure | undefined> {
  const {
    isBackendRecipe,
    addRecipeIngredientMutation,
    addItemsToShoppingListMutation,
    fallback,
    unnamedIngredient,
    unitSystem,
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
      itemName: ingredient.name || unnamedIngredient,
      quantity:
        'quantity' in ingredient && typeof ingredient.quantity === 'number'
          ? ingredient.quantity
          : null,
      unitName:
        typeof unit === 'string'
          ? unit
          : firstNonBlank(unit?.symbol, unit?.name) ?? null,
      itemId: linkedItem?.id,
    });

    const settled = await settleMutation(
      () =>
        addRecipeIngredientMutation({
          variables: {
            input: {
              id: rowId,
              recipeIngredientId: String(ingredient.id),
              shoppingListId,
            },
          },
          context: { localFirst: true },
        }),
      {
        document: CreateShoppingListItemFromRecipeIngredientDocument,
        fallback,
        onFailed: () => revertOptimisticRow(rowId),
        present: 'none',
      },
    );
    return settled.failure;
  }

  if ('amount' in ingredient) {
    // Single ingredient goes through the same batch mutation as a
    // one-element `items` array — there is no separate single-add op.
    const rowId = generateEntityId();
    const itemName = stripPriceFromName(
      ingredient.name || ingredient.original || unnamedIngredient,
    );
    // Amount and unit from ONE measure. Taking the unit from `measures.us`
    // while the quantity stayed `ingredient.amount` is what stored a
    // metric-authored "200 g" as "200 oz".
    const measure = preferredMeasure(ingredient.measures, unitSystem, {
      amount: ingredient.amount,
      unitShort: ingredient.unit,
    });
    const quantity = measure.amount ?? 0;
    const unitName = measure.unit || undefined;

    writeOptimisticRow(rowId, {
      itemName,
      quantity,
      unitName: unitName ?? null,
    });

    const storePrefs = ingredient.aisle
      ? { aisle: ingredient.aisle }
      : undefined;
    const settled = await settleMutation(
      () =>
        addItemsToShoppingListMutation({
          variables: {
            input: {
              shoppingListId,
              items: [
                {
                  id: rowId,
                  item: { itemName },
                  quantity,
                  unit: { unitName },
                  storePrefs,
                },
              ],
            },
          },
          context: { localFirst: true },
        }),
      {
        document: AddItemsToShoppingListFromRecipeDocument,
        fallback,
        onFailed: () => revertOptimisticRow(rowId),
        present: 'none',
      },
    );
    return settled.failure;
  }

  return undefined;
}

export function useRecipeShoppingList({
  recipeId,
  isBackendRecipe,
  backendRecipe,
  externalRecipe,
}: UseRecipeShoppingListOptions) {
  const { t } = useTranslation();
  const { settings } = useAppSettings();
  const unitSystem = settings.preferredUnitSystem;
  const { data: shoppingListsData, loading: shoppingListsLoading } = useQuery(
    GetShoppingListsLiteForRecipeDocument,
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
    shoppingLists.find(list => list.id === listId) ?? null;

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
  const [createShoppingListMutation] = useMutation(
    CreateShoppingListForRecipeDocument,
    {
      update(cache, { data }) {
        const payload = appliedPayload(data);
        if (payload) addShoppingListToQueryCache(cache, payload.shoppingList);
      },
    },
  );

  const [createShoppingListItemsFromRecipeMutation] = useMutation(
    CreateShoppingListItemsFromRecipeDocument,
    {
      update: (cache, { data }, { variables }) => {
        const payload = appliedPayload(data);
        if (!payload || !variables) return;
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
    },
  );

  const [addRecipeIngredientMutation] = useMutation(
    CreateShoppingListItemFromRecipeIngredientDocument,
    {
      update: (cache, { data }, { variables }) => {
        const response = appliedPayload(data);
        if (!response || !variables) return;
        try {
          // The row was already written and counted optimistically, so this
          // only re-wires the edge — and withdraws the optimistic row when the
          // server merged the ingredient into an existing line.
          reconcileShoppingItemCreateUpdate(
            cache,
            variables.input.shoppingListId,
            response.shoppingListItem,
            variables.input.id,
          );
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
      // Every row here was written and counted by an optimistic add before the
      // mutation fired, so the reconcile re-wires edges without re-counting.
      update: buildAddItemsReconcileUpdate({
        wrap: { operation: 'Cache update failed for addItemsToShoppingList:' },
      }),
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
      const failure = await addIngredientToList(ingredient, listId, {
        isBackendRecipe,
        addRecipeIngredientMutation,
        addItemsToShoppingListMutation,
        unitSystem,
        fallback: t('recipes.addIngredientToListFailed'),
        unnamedIngredient: t('recipes.unnamedIngredient'),
        // Written before the mutation fires so the row shows immediately and
        // survives being queued — the `update:` callbacks only run with a
        // server payload, so offline they never fire.
        writeOptimisticRow: (rowId, fields) => {
          const row = createOptimisticShoppingListItem(rowId, {
            shoppingListId: listId,
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
      if (failure) {
        toastService.error(failure.body);
        return;
      }

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
    const externalIngredients = externalRecipe?.extendedIngredients ?? [];

    void executeWithLoadingState(
      async () => {
        if (isBackendRecipe && backendRecipe && recipeId) {
          const settled = await settleMutation(
            () =>
              createShoppingListItemsFromRecipeMutation({
                variables: {
                  input: {
                    recipeId,
                    shoppingListId: listId,
                    servings: backendRecipe.servings,
                  },
                },
              }),
            {
              document: CreateShoppingListItemsFromRecipeDocument,
              fallback: t('recipes.addIngredientsToListFailed'),
              present: 'none',
            },
          );
          if (settled.failure) {
            toastService.error(settled.failure.body);
            return;
          }

          const payload = appliedPayload(settled.data);
          if (payload) {
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
        } else if (externalIngredients.length > 0) {
          const items: BatchAddShoppingListItemInput[] =
            externalIngredients.map((ingredient, index) => {
              // Amount and unit from ONE measure, so the two always agree.
              const measure = preferredMeasure(
                ingredient.measures,
                unitSystem,
                { amount: ingredient.amount, unitShort: ingredient.unit },
              );
              return {
                // `id` is the row's primary key (so a queued batch replays
                // idempotently); `clientId` stays the ingredient index used
                // below to match each result back to its ingredient.
                id: generateEntityId(),
                clientId: String(ingredient.id || index),
                item: {
                  itemName: stripPriceFromName(
                    ingredient.name ||
                      ingredient.original ||
                      t('recipes.unnamedIngredient'),
                  ),
                },
                quantity: measure.amount ?? 0,
                unit: { unitName: measure.unit },
                storePrefs: ingredient.aisle
                  ? { aisle: ingredient.aisle }
                  : undefined,
              };
            });

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
              shoppingListId: listId,
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

          // A refusal resolves under errorPolicy:'all' with no thrown error, so
          // the rows have to be taken back explicitly or they linger until the
          // next refetch. A QUEUED batch is not a refusal — it keeps its rows.
          const revertRows = () => {
            items.forEach(batchItem => {
              if (batchItem.id) {
                revertOptimisticShoppingListItem(
                  client.cache,
                  listId,
                  batchItem.id,
                );
              }
            });
          };
          const settled = await settleMutation(
            () =>
              addItemsToShoppingListMutation({
                variables: { input: { shoppingListId: listId, items } },
                context: { localFirst: true },
              }),
            {
              document: AddItemsToShoppingListFromRecipeDocument,
              fallback: t('recipes.addIngredientsToListFailed'),
              onFailed: revertRows,
              present: 'none',
            },
          );
          if (settled.failure) {
            toastService.error(settled.failure.body);
            return;
          }

          const payload = appliedPayload(settled.data);
          if (payload) {
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
          } else {
            // Queued while offline / the API was unreachable. The items replay
            // later; mark them all added and confirm so the recipe reflects it.
            setAddedIngredients(prev => {
              const next = new Set(prev);
              externalIngredients.forEach(ing => next.add(ing.id));
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

    void executeWithLoadingState(
      async () => {
        const fallback = t('errors.createShoppingListFailed');
        const settled = await settleMutation(
          () =>
            createShoppingListMutation({
              variables: {
                input: {
                  name: name.trim(),
                  description: t('recipes.createdFromRecipe'),
                  isDefault: false,
                  tags: ['recipe-created'],
                },
              },
            }),
          {
            document: CreateShoppingListForRecipeDocument,
            fallback,
            present: 'none',
          },
        );

        const createPayload = appliedPayload(settled.data);
        if (!createPayload) {
          toastService.error(settled.failure?.body ?? fallback);
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
