import { useState } from 'react';
import { useScreenFocusEffect } from '#platform/screen';
import type { ApolloCache } from '@apollo/client';
import {
  useApolloClient,
  useFragment,
  useMutation,
} from '@apollo/client/react';
import {
  AddDerivedItemsToShoppingListDocument,
  UseGenerateShoppingList_MealPlanFragmentDoc,
  type UseGenerateShoppingList_MealPlanFragment,
  GenerateShoppingListPlanDocument,
} from '#features/mealPlan/hooks/useGenerateShoppingList.generated';
import {
  deriveShoppingListFromMealPlan,
  type PlannedMeal,
  type PantryStock,
} from '#features/mealPlan/utils/deriveShoppingListFromMealPlan';
import {
  addItemsInSlices,
  addLocalShoppingListItem,
  buildAddItemsReconcileUpdate,
  createLocalShoppingListItem,
} from '#features/shoppingList/cache/items';
import {
  useCreateShoppingList,
  type StartingLines,
} from '#features/shoppingList/hooks/useCreateShoppingList';
import type {
  BatchAddShoppingListItemInput,
  CreateShoppingListInput,
} from '#/graphql/generated/schemaTypes';
import { usePantryQuery } from '#features/pantry/hooks/usePantryQuery';
import { useAppStore, useSelectedPantryId } from '#store/useAppStore';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { errorService } from '#/services/errorService';
import { t as tGlobal, useTranslation } from '#/i18n';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { MEALS_PAGE_SIZE } from '#features/mealPlan/utils/mealPlanPaging';
import {
  MAX_RECIPE_INGREDIENTS,
  RECIPE_INGREDIENTS_PAGE_SIZE,
} from '#domain/recipeIngredientsPaging';

/** What the caller may choose; the plan and its lines come from the cache. */
export interface GenerateShoppingListOptions {
  checkPantry?: boolean;
  name?: string;
  shoppingListId?: string;
}

/**
 * Why a plan cannot be derived from, in the user's words: its later meal pages
 * are unread, or a recipe over the ingredient limit holds only its first page,
 * so the list would come out short. Null for a plan read to the end.
 */
function unreadSource(
  plan: UseGenerateShoppingList_MealPlanFragment,
): string | null {
  if (plan.mealPlanItemsConnection.pageInfo.hasNextPage) {
    return tGlobal('generateShoppingList.planNotLoaded');
  }
  const overLimit = plan.mealPlanItemsConnection.edges
    .map(meal => meal.node.recipe)
    .find(recipe => recipe?.ingredientsConnection.pageInfo.hasNextPage);
  return overLimit
    ? tGlobal('generateShoppingList.recipeOverLimit', {
        name: overLimit.name,
        count: MAX_RECIPE_INGREDIENTS,
      })
    : null;
}

/**
 * Builds the list from the cached plan instead of asking the server to fan out,
 * so it works offline: a create carrying the lines and the plan, then batch
 * adds for any past its 50, every one queued and keyed by a client-minted id.
 */
export function useGenerateShoppingList(mealPlanId: string | null) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const pantryId = useSelectedPantryId();

  const { data: plan, complete } = useFragment({
    fragment: UseGenerateShoppingList_MealPlanFragmentDoc,
    fragmentName: 'useGenerateShoppingList_mealPlan',
    from: mealPlanId ? { __typename: 'MealPlan', id: mealPlanId } : null,
  });

  // Cache-only: the pantry tab mounts at cold start, and a miss reads as "not
  // checked", never an empty pantry. Stands down while blurred; the preserved
  // connection holds the last read.
  const [isFocused, setIsFocused] = useState(true);
  const [onFocusChange] = useState(() => () => {
    setIsFocused(true);
    return () => setIsFocused(false);
  });
  useScreenFocusEffect(onFocusChange);
  const pantry = usePantryQuery(pantryId ?? undefined, null, null, undefined, {
    skip: !isFocused,
    fetchPolicy: 'cache-only',
  });

  const { createShoppingList, loading: creating } = useCreateShoppingList(
    t('generateShoppingList.generateFailed'),
  );

  const [addItems, { loading: adding }] = useMutation(
    AddDerivedItemsToShoppingListDocument,
    {
      context: { localFirst: true },
      update: buildAddItemsReconcileUpdate({}),
    },
  );

  const apiUnavailable = useAppStore(isApiUnavailable);

  // An imported recipe's ingredients link to catalog items on a server job, so
  // a plan cached straight after the import holds `item: null` and the derive
  // would skip them. One network read picks up whatever has linked since.
  const withLinkedIngredients = async (
    id: string,
    cached: UseGenerateShoppingList_MealPlanFragment,
  ): Promise<UseGenerateShoppingList_MealPlanFragment> => {
    const unlinked = cached.mealPlanItemsConnection.edges.some(meal =>
      meal.node.recipe?.ingredientsConnection.edges.some(
        edge => !edge.node.item,
      ),
    );
    if (!unlinked || apiUnavailable) return cached;

    const fetched = await client
      .query({
        query: GenerateShoppingListPlanDocument,
        variables: {
          id,
          mealsFirst: MEALS_PAGE_SIZE,
          ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
        },
        fetchPolicy: 'network-only',
      })
      .catch(() => null);
    if (!fetched || fetched.error) return cached;

    const cacheId = client.cache.identify({ __typename: 'MealPlan', id });
    if (!cacheId) return cached;
    return (
      client.cache.readFragment<UseGenerateShoppingList_MealPlanFragment>({
        id: cacheId,
        fragment: UseGenerateShoppingList_MealPlanFragmentDoc,
        fragmentName: 'useGenerateShoppingList_mealPlan',
      }) ?? cached
    );
  };

  const generateShoppingList = async (
    options: GenerateShoppingListOptions = {},
  ) => {
    if (!mealPlanId || !complete) {
      toastService.error(t('generateShoppingList.planNotLoaded'));
      return null;
    }
    const unread = unreadSource(plan);
    if (unread) {
      toastService.error(unread);
      return null;
    }

    const source = await withLinkedIngredients(mealPlanId, plan);
    // The re-read restates each first page: a plan that outgrew its own has
    // unread meals again, and a recipe that did is over the ingredient limit.
    const unreadSince = unreadSource(source);
    if (unreadSince) {
      toastService.error(unreadSince);
      return null;
    }

    const meals: PlannedMeal[] = source.mealPlanItemsConnection.edges.map(
      ({ node: item }) => ({
        id: item.id,
        servings: item.servings,
        recipe: item.recipe
          ? {
              id: item.recipe.id,
              servings: item.recipe.servings,
              ingredients: item.recipe.ingredientsConnection.edges.map(
                edge => ({
                  id: edge.node.id,
                  name: edge.node.name,
                  quantity: edge.node.quantity,
                  isOptional: edge.node.isOptional,
                  unitId: edge.node.unit?.id,
                  itemId: edge.node.item?.id,
                }),
              ),
            }
          : null,
      }),
    );

    const pantryRows: PantryStock[] | null = pantry.state.hasResult
      ? pantry.state.pantryItems.map(row => ({
          itemId: row.itemId,
          unitId: row.unit.id,
          quantity: row.quantity,
        }))
      : null;

    const { inputs, displayNames, skipped, pantryChecked } =
      deriveShoppingListFromMealPlan(meals, {
        mealPlanId,
        checkPantry: options.checkPantry ?? true,
        pantryRows,
      });

    if (inputs.length === 0) {
      toastService.info(t('generateShoppingList.nothingToAdd'));
      return null;
    }

    const listName =
      firstNonBlank(options.name)?.trim() ?? defaultListName(source.name);
    const target = await targetList(
      options.shoppingListId,
      { name: listName, homeId: source.homeId, mealPlanId },
      {
        items: inputs,
        // One batch: watchers re-read once for the whole list, not once per line.
        write: listId =>
          client.cache.batch({
            update: cache => {
              for (const line of inputs) {
                writeLineToCache(cache, listId, line, displayNames);
              }
            },
          }),
      },
    );
    if (!target) return null;
    const { listId } = target;

    const addFailure = await addItemsInSlices(
      client.cache,
      listId,
      target.unsent,
      slice =>
        addItems({
          variables: { input: { shoppingListId: listId, items: slice } },
        }),
      {
        document: AddDerivedItemsToShoppingListDocument,
        fallback: t('generateShoppingList.generateFailed'),
      },
    );

    if (addFailure) {
      toastService.error(addFailure.body);
      return null;
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

  /**
   * Where the lines go and which are still to send, or null once a refused
   * create is presented. A new list is made with its lines and names its plan,
   * so one write does what a create, an add and a link did.
   */
  async function targetList(
    existingId: string | undefined,
    create: CreateShoppingListInput,
    lines: StartingLines<BatchAddShoppingListItemInput>,
  ) {
    if (existingId) {
      lines.write(existingId);
      return { listId: existingId, unsent: lines.items };
    }
    const created = await createShoppingList(create, lines);
    if (created.status === 'created') {
      return { listId: created.shoppingList.id, unsent: created.unsent };
    }
    toastService.error(created.body);
    return null;
  }

  function writeLineToCache(
    cache: ApolloCache,
    listId: string,
    line: { id?: string | null; item: { itemId?: string | null } },
    names: Map<string, string>,
  ) {
    if (!line.id) return;
    // Built before the try: a value block inside one bails the whole function
    // out of the React Compiler.
    const row = createLocalShoppingListItem(line.id, {
      shoppingListId: listId,
      itemName: names.get(line.id) ?? t('labels.item'),
      itemId: line.item.itemId,
    });
    try {
      addLocalShoppingListItem(cache, listId, row);
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
  tGlobal('generateShoppingList.defaultName', { name: planName ?? '' });

function report(outcome: {
  name: string;
  added: number;
  skipped: number;
  pantryChecked: boolean;
  checkPantry: boolean | undefined;
}) {
  toastService.success(
    tGlobal('generateShoppingList.createdSuccess', {
      name: outcome.name,
      count: outcome.added,
      shared: '',
    }),
  );
  if (outcome.skipped > 0) {
    toastService.info(
      tGlobal('generateShoppingList.someSkipped', { count: outcome.skipped }),
    );
  }
  if ((outcome.checkPantry ?? true) && !outcome.pantryChecked) {
    toastService.info(tGlobal('generateShoppingList.pantryNotChecked'));
  }
}
