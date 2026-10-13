import { useState } from 'react';
import type { ApolloCache } from '@apollo/client';
import { useTranslation } from '#/i18n';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { CreateOutcome } from '#/graphql/generated/schemaTypes';
import type { MaterializedRecipe, DisplayIngredient } from './useRecipeData';
import {
  AddItemsToShoppingListFromRecipeDocument,
  CreateShoppingListForRecipeDocument,
  type AddItemsToShoppingListFromRecipeMutation,
} from './useRecipeDetail.generated';
import { useShoppingListsLite } from '#features/shoppingList/hooks/useShoppingListsLite';
import { useActiveShoppingListId } from '#features/shoppingList/hooks/useActiveShoppingListId';
import { useAppStore } from '#store/useAppStore';
import { addShoppingListToQueryCache } from '#features/shoppingList/cache/list';
import { settleMutation, settledStatus } from '#/apollo/utils/settleMutation';
import { toastService } from '#/services/toastService';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import {
  addItemsInSlices,
  addLocalShoppingListItem,
  buildAddItemsReconcileUpdate,
  createLocalShoppingListItem,
} from '#features/shoppingList/cache/items';
import { logger } from '#/utils/environment';
import { errorService } from '#/services/errorService';
import {
  recipeShoppingRows,
  type RecipeShoppingRow,
} from '#features/recipes/utils/recipeShoppingRows';
import { MAX_RECIPE_INGREDIENTS } from '#domain/recipeIngredientsPaging';

interface UseRecipeShoppingListOptions {
  recipeId: string | undefined;
  backendRecipe: MaterializedRecipe | null | undefined;
}

type PendingAction = { type: 'all' };

/** What became of the rows sent: every row is added, updated or refused. */
interface AddOutcome {
  added: number;
  updated: number;
  /** The minted ids of the rows that did not land, alone or with their slice. */
  refused: ReadonlySet<string>;
  /** A slice failed, and its message is already shown. */
  failed: boolean;
}

interface AddTally {
  updated: number;
  refused: Set<string>;
}

/**
 * Reconciles a batch's results and counts them. A MERGED line is an update
 * only when the list already showed it: the server also answers MERGED for a
 * bought or removed line it reuses, which reappears on the list.
 */
function reconcileAndTally(tally: AddTally) {
  return (
    cache: ApolloCache,
    result: { data?: AddItemsToShoppingListFromRecipeMutation | null },
    options: Parameters<ReturnType<typeof buildAddItemsReconcileUpdate>>[2],
  ): void => {
    const lines = appliedPayload(result.data)?.results ?? [];
    buildAddItemsReconcileUpdate({
      onLine: ({ position, clientId, refused, listedBefore }) => {
        if (refused) {
          if (clientId) tally.refused.add(clientId);
        } else if (
          listedBefore &&
          lines[position]?.outcome === CreateOutcome.Merged
        ) {
          tally.updated += 1;
        }
      },
    })(cache, result, options);
  };
}

/**
 * Sends one slice. A slice that fails takes its rows back, so they are recorded
 * as refused: the slices beside it still land, and their rows stay marked.
 */
function sendSlice<TResult extends { data?: unknown; error?: unknown }>(
  send: () => Promise<TResult>,
  slice: readonly { id: string }[],
  refused: Set<string>,
): Promise<TResult> {
  const markRefused = () => {
    for (const line of slice) refused.add(line.id);
  };
  return send().then(
    result => {
      if (settledStatus(result) === 'failed') markRefused();
      return result;
    },
    (error: unknown) => {
      markRefused();
      throw error;
    },
  );
}

/**
 * Writes the rows before the add fires, so they show at once and survive being
 * queued: an `update` callback only runs with a server payload.
 */
function writeLocalRows(
  cache: ApolloCache,
  listId: string,
  rows: readonly RecipeShoppingRow[],
): void {
  cache.batch({
    update: batched => {
      for (const { input, display } of rows) {
        const row = createLocalShoppingListItem(input.id, {
          shoppingListId: listId,
          itemName: display.itemName,
          quantity: display.quantity,
          quantityInput: null,
          unitName: display.unitName,
          category: null,
          itemId: display.itemId,
          unitId: undefined,
        });
        try {
          addLocalShoppingListItem(batched, listId, row);
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Add recipe ingredients (optimistic)',
          });
        }
      }
    },
  });
}

export function useRecipeShoppingList({
  recipeId,
  backendRecipe,
}: UseRecipeShoppingListOptions) {
  const { t } = useTranslation();
  const { lists: shoppingLists, loading: shoppingListsLoading } =
    useShoppingListsLite();

  const targetListId = useActiveShoppingListId(shoppingLists);
  const setSelectedShoppingListId = useAppStore(
    state => state.setSelectedShoppingListId,
  );

  const getShoppingListById = (listId: string | undefined) =>
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

  // One door for a single ingredient and for the whole recipe: a batch add
  // whose rows the device derives and mints, so both queue and replay.
  const [addItemsMutation] = useMutation(
    AddItemsToShoppingListFromRecipeDocument,
    { context: { localFirst: true } },
  );

  /** Sends derived rows and resolves to what became of them, a failure shown. */
  const addRows = async (
    listId: string,
    rows: readonly RecipeShoppingRow[],
    fallback: string,
  ): Promise<AddOutcome> => {
    writeLocalRows(client.cache, listId, rows);
    const tally: AddTally = { updated: 0, refused: new Set() };
    const failure = await addItemsInSlices(
      client.cache,
      listId,
      rows.map(row => row.input),
      slice =>
        sendSlice(
          () =>
            addItemsMutation({
              variables: { input: { shoppingListId: listId, items: slice } },
              update: reconcileAndTally(tally),
            }),
          slice,
          tally.refused,
        ),
      { document: AddItemsToShoppingListFromRecipeDocument, fallback },
    );
    if (failure) toastService.error(failure.body);
    // A queued row has no answer yet and replays on reconnect: it counts as added.
    return {
      added: rows.length - tally.updated - tally.refused.size,
      updated: tally.updated,
      refused: tally.refused,
      failed: failure !== null,
    };
  };

  // Add a single ingredient to the user's default/selected list (no picker).
  const handleAddSingleIngredient = async (ingredient: DisplayIngredient) => {
    if (!recipeId) {
      toastService.error(t('recipes.noIngredientsToAdd'));
      return;
    }
    const targetList = getShoppingListById(targetListId);
    if (!targetList) {
      toastService.error(t('recipes.createListFirst'));
      return;
    }

    const rows = recipeShoppingRows(recipeId, [ingredient], {
      unnamed: t('recipes.unnamedIngredient'),
      includeOptional: true,
    });
    const fallback = t('recipes.addIngredientToListFailed');
    const outcome = await addRows(targetList.id, rows, fallback);
    if (outcome.failed) return;
    if (outcome.refused.size > 0) {
      toastService.error(fallback);
      return;
    }

    setAddedIngredients(prev => new Set(prev).add(ingredient.id));
    toastService.success(
      t('recipes.addedToList', { listName: targetList.name }),
    );
  };

  // `hasNextPage` marks a recipe over the ingredient limit: the device holds
  // only its first page, which would add a short list.
  const refusesRecipeOverLimit = (): boolean => {
    if (!backendRecipe?.ingredientsConnection.pageInfo.hasNextPage) {
      return false;
    }
    toastService.error(
      t('recipes.ingredientsOverLimit', { count: MAX_RECIPE_INGREDIENTS }),
    );
    return true;
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
    // Asked again: a refresh while the picker is open can find the recipe grown
    // past the limit.
    if (refusesRecipeOverLimit()) return;
    void executeWithLoadingState(
      async () => {
        const rows =
          backendRecipe && recipeId
            ? recipeShoppingRows(
                recipeId,
                backendRecipe.ingredientsConnection.edges.map(
                  edge => edge.node,
                ),
                { unnamed: t('recipes.unnamedIngredient') },
              )
            : [];
        if (rows.length === 0) {
          toastService.error(t('recipes.noIngredientsToAdd'));
          return;
        }
        const fallback = t('recipes.addIngredientsToListFailed');
        const { added, updated, refused, failed } = await addRows(
          listId,
          rows,
          fallback,
        );
        // A refused row stays unmarked, so it can be added on its own; the rows
        // of the slices that landed are marked even when another slice failed.
        setAddedIngredients(prev => {
          const next = new Set(prev);
          for (const row of rows) {
            if (!refused.has(row.input.id)) next.add(row.recipeIngredientId);
          }
          return next;
        });
        if (failed) return;
        if (added + updated === 0) {
          toastService.error(fallback);
          return;
        }
        toastService.success(
          updated > 0
            ? t('recipes.addedItemsToListUpdated', {
                count: added,
                listName: resolvedName,
                updated,
              })
            : t('recipes.addedItemsToList', {
                count: added,
                listName: resolvedName,
              }),
        );
      },
      setAddingToList,
      err => {
        logger.error('Failed to add ingredients:', err);
        toastService.error(t('recipes.addIngredientsToListFailed'));
      },
    );
  };

  // Entry point from the recipe ingredient list "Add All" button. Refused
  // before the picker opens, so no list is picked or created for nothing.
  const handleAddAll = () => {
    if (refusesRecipeOverLimit()) return;
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
