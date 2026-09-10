import {
  useApolloClient,
  useFragment,
  useMutation,
} from '@apollo/client/react';
import {
  AddDerivedItemsToShoppingListDocument,
  LinkDerivedListToMealPlanDocument,
  UseGenerateShoppingList_MealPlanFragmentDoc,
} from '#features/mealPlan/hooks/useGenerateShoppingList.generated';
import {
  deriveShoppingListFromMealPlan,
  type PlannedMeal,
  type PantryStock,
} from '#features/mealPlan/utils/deriveShoppingListFromMealPlan';
import {
  addOptimisticShoppingListItem,
  buildAddItemsReconcileUpdate,
  createOptimisticShoppingListItem,
} from '#features/shoppingList/cache/items';
import { useCreateShoppingList } from '#features/shoppingList/hooks/useCreateShoppingList';
import { usePantryQuery } from '#features/pantry/hooks/usePantryQuery';
import { useSelectedPantryId } from '#store/useAppStore';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { errorService } from '#/services/errorService';
import { t } from '#/i18n';

/** What the caller may choose; the plan and its lines come from the cache. */
export interface GenerateShoppingListOptions {
  checkPantry?: boolean;
  name?: string;
  shoppingListId?: string;
}

/**
 * Builds the list from the cached plan instead of asking the server to fan out,
 * so it works offline: a create, a batch add, and a link back to the plan,
 * every one of them queued and keyed by a client-minted id.
 */
export function useGenerateShoppingList(mealPlanId: string | null) {
  const client = useApolloClient();
  const pantryId = useSelectedPantryId();

  const { data: plan, complete } = useFragment({
    fragment: UseGenerateShoppingList_MealPlanFragmentDoc,
    fragmentName: 'useGenerateShoppingList_mealPlan',
    from: mealPlanId ? { __typename: 'MealPlan', id: mealPlanId } : null,
  });

  // Cache-only: the pantry tab mounts at cold start, so its rows are already
  // there — and a miss must read as "not checked", never as an empty pantry.
  const pantry = usePantryQuery(pantryId ?? undefined, null, null, undefined, {
    fetchPolicy: 'cache-only',
  });

  const { createShoppingList, loading: creating } = useCreateShoppingList(
    t('generateShoppingList.generateFailed'),
  );

  const [addItems, { loading: adding }] = useMutation(
    AddDerivedItemsToShoppingListDocument,
    { update: buildAddItemsReconcileUpdate({}) },
  );

  const [linkToPlan] = useMutation(LinkDerivedListToMealPlanDocument);

  const generateShoppingList = async (
    options: GenerateShoppingListOptions = {},
  ) => {
    if (!mealPlanId || !complete) {
      toastService.error(t('generateShoppingList.planNotLoaded'));
      return null;
    }

    const meals: PlannedMeal[] = plan.mealPlanItems.map(item => ({
      id: item.id,
      servings: item.servings,
      recipe: item.recipe
        ? {
            id: item.recipe.id,
            servings: item.recipe.servings,
            ingredients: item.recipe.ingredientsConnection.edges.map(edge => ({
              id: edge.node.id,
              name: edge.node.name,
              quantity: edge.node.quantity,
              unitId: edge.node.unit?.id,
              itemId: edge.node.item?.id,
            })),
          }
        : null,
    }));

    const pantryRows: PantryStock[] | null = pantry.state.hasResult
      ? pantry.state.pantryItems.map(row => ({
          itemId: row.itemId,
          unitId: row.unit?.id,
          quantity: row.quantity,
        }))
      : null;

    const { inputs, displayNames, skipped, pantryChecked } =
      deriveShoppingListFromMealPlan(meals, {
        mealPlanId,
        mealPlanName: plan.name,
        checkPantry: options.checkPantry ?? true,
        pantryRows,
      });

    if (inputs.length === 0) {
      toastService.info(t('generateShoppingList.nothingToAdd'));
      return null;
    }

    const listName = options.name?.trim() || defaultListName(plan.name);
    let listId = options.shoppingListId ?? null;
    if (!listId) {
      // `createShoppingList` THROWS a refusal rather than returning one, so an
      // unguarded call would surface a domain error at the screen. Assign in
      // the try and read outside it: a value block inside bails the compiler.
      let created;
      try {
        created = await createShoppingList({
          name: listName,
          homeId: plan.homeId,
        });
      } catch (error) {
        errorService.reportError(error, {
          operation: 'Generate shopping list',
        });
      }
      listId = created?.id ?? null;
    }
    if (!listId) return null;

    for (const line of inputs) {
      writeLineToCache(listId, line, displayNames);
    }

    try {
      await addItems({
        variables: { input: { shoppingListId: listId, items: inputs } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, { operation: 'Generate shopping list' });
    }

    // Queued like the writes above: the list carries no plan of its own until
    // this lands, so the plan's generated-lists section fills in on replay.
    if (!options.shoppingListId) {
      try {
        await linkToPlan({
          variables: { input: { id: listId, mealPlanId } },
          context: { localFirst: true },
        });
      } catch (error) {
        errorService.reportError(error, {
          operation: 'Link derived list to meal plan',
        });
      }
    }

    report({
      name: listName,
      added: inputs.length,
      skipped: skipped.length,
      pantryChecked,
      checkPantry: options.checkPantry,
    });
    Telemetry.trackEvent('shopping_list_generated_from_meal_plan', {
      meal_plan_id: mealPlanId,
      check_pantry: options.checkPantry ?? true,
      added_to_existing: !!options.shoppingListId,
      derived_lines: inputs.length,
      skipped_sources: skipped.length,
    });
    return { shoppingListId: listId, lineCount: inputs.length };
  };

  function writeLineToCache(
    listId: string,
    line: { id?: string | null; item: { itemId?: string | null } },
    names: Map<string, string>,
  ) {
    if (!line.id) return;
    // Built before the try: a value block inside one bails the whole function
    // out of the React Compiler.
    const row = createOptimisticShoppingListItem(line.id, {
      shoppingListId: listId,
      itemName: names.get(line.id) ?? t('labels.item'),
      itemId: line.item.itemId,
    });
    try {
      addOptimisticShoppingListItem(client.cache, listId, row);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Generate shopping list (optimistic)',
      });
    }
  }

  return {
    generateShoppingList,
    loading: creating || adding,
  };
}

const defaultListName = (planName: string | null | undefined) =>
  t('generateShoppingList.defaultName', { name: planName ?? '' });

function report(outcome: {
  name: string;
  added: number;
  skipped: number;
  pantryChecked: boolean;
  checkPantry: boolean | undefined;
}) {
  toastService.success(
    t('generateShoppingList.createdSuccess', {
      name: outcome.name,
      count: outcome.added,
      shared: '',
    }),
  );
  if (outcome.skipped > 0) {
    toastService.info(
      t('generateShoppingList.someSkipped', { count: outcome.skipped }),
    );
  }
  if ((outcome.checkPantry ?? true) && !outcome.pantryChecked) {
    toastService.info(t('generateShoppingList.pantryNotChecked'));
  }
}
