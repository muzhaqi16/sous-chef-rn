import {
  useApolloClient,
  useFragment,
  useMutation,
} from '@apollo/client/react';
import {
  AddDerivedItemsToShoppingListDocument,
  LinkDerivedListToMealPlanDocument,
  UseGenerateShoppingList_MealPlanFragmentDoc,
  type UseGenerateShoppingList_MealPlanFragment,
} from '#features/mealPlan/hooks/useGenerateShoppingList.generated';
import { GetMealPlanDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import {
  deriveShoppingListFromMealPlan,
  type PlannedMeal,
  type PantryStock,
} from '#features/mealPlan/utils/deriveShoppingListFromMealPlan';
import {
  addItemsInSlices,
  addOptimisticShoppingListItem,
  buildAddItemsReconcileUpdate,
  createOptimisticShoppingListItem,
} from '#features/shoppingList/cache/items';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useCreateShoppingList } from '#features/shoppingList/hooks/useCreateShoppingList';
import { usePantryQuery } from '#features/pantry/hooks/usePantryQuery';
import { useAppStore, useSelectedPantryId } from '#store/useAppStore';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { errorService } from '#/services/errorService';
import { t } from '#/i18n';
import { firstNonBlank } from '#/utils/firstNonBlank';

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
  const apiUnavailable = useAppStore(isApiUnavailable);

  // An imported recipe's ingredients link to catalog items on a server job, so
  // a plan cached straight after the import holds `item: null` and the derive
  // would skip them. One network read picks up whatever has linked since.
  const withLinkedIngredients = async (
    id: string,
    cached: UseGenerateShoppingList_MealPlanFragment,
  ): Promise<UseGenerateShoppingList_MealPlanFragment> => {
    const unlinked = cached.mealPlanItems.some(item =>
      item.recipe?.ingredientsConnection.edges.some(edge => !edge.node.item),
    );
    if (!unlinked || apiUnavailable) return cached;

    const fetched = await client
      .query({
        query: GetMealPlanDocument,
        variables: { id },
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

    const source = await withLinkedIngredients(mealPlanId, plan);

    const meals: PlannedMeal[] = source.mealPlanItems.map(item => ({
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
          unitId: row.unit.id,
          quantity: row.quantity,
        }))
      : null;

    const { inputs, displayNames, skipped, pantryChecked } =
      deriveShoppingListFromMealPlan(meals, {
        mealPlanId,
        mealPlanName: source.name,
        checkPantry: options.checkPantry ?? true,
        pantryRows,
      });

    if (inputs.length === 0) {
      toastService.info(t('generateShoppingList.nothingToAdd'));
      return null;
    }

    const listName =
      firstNonBlank(options.name)?.trim() ?? defaultListName(source.name);
    const listId =
      options.shoppingListId ?? (await createList(listName, source.homeId));
    if (!listId) return null;

    for (const line of inputs) {
      writeLineToCache(listId, line, displayNames);
    }

    const addFailure = await addItemsInSlices(
      client.cache,
      listId,
      inputs,
      slice =>
        addItems({
          variables: { input: { shoppingListId: listId, items: slice } },
          context: { localFirst: true },
        }),
      {
        document: AddDerivedItemsToShoppingListDocument,
        fallback: t('generateShoppingList.generateFailed'),
      },
    );

    // Queued like the writes above: the list carries no plan of its own until
    // this lands, so the plan's generated-lists section fills in on replay.
    const linked = options.shoppingListId
      ? null
      : await settleMutation(
          () =>
            linkToPlan({
              variables: { input: { id: listId, mealPlanId } },
              context: { localFirst: true },
            }),
          {
            document: LinkDerivedListToMealPlanDocument,
            fallback: t('generateShoppingList.generateFailed'),
            present: 'none',
          },
        );
    const failure = addFailure ?? linked?.failure;
    if (failure) {
      toastService.error(failure.body);
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

  /** The new list's id, or null once its refusal is presented. */
  async function createList(name: string, homeId: string | null) {
    const created = await createShoppingList({ name, homeId });
    if (created.status === 'created') return created.shoppingList.id;
    toastService.error(created.body);
    return null;
  }

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
