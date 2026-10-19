'use no memo';

const mockUsePantryQuery = jest.fn();
jest.mock('#features/pantry/hooks/usePantryQuery', () => {
  const actual = jest.requireActual<
    typeof import('#features/pantry/hooks/usePantryQuery')
  >('#features/pantry/hooks/usePantryQuery');
  return {
    usePantryQuery: (...args: Parameters<typeof actual.usePantryQuery>) => {
      mockUsePantryQuery(...args);
      return actual.usePantryQuery(...args);
    },
  };
});

import { memoryScreen } from '#/test-utils/memoryPlatform';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  AddDerivedItemsToShoppingListDocument,
  LinkDerivedListToMealPlanDocument,
} from '#features/mealPlan/hooks/useGenerateShoppingList.generated';
import { CreateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { GenerateShoppingListPlanDocument } from '#features/mealPlan/hooks/useGenerateShoppingList.generated';
import { toastService } from '#/services/toastService';
import { seedCache } from '#/test-utils/apolloMockProvider';
import { UseGenerateShoppingList_MealPlanFragmentDoc } from '#features/mealPlan/hooks/useGenerateShoppingList.generated';
import { useStore } from '#store';
import { AddedContext, ErrorCode } from '#/graphql/generated/schemaTypes';
import { MEALS_PAGE_SIZE } from '#features/mealPlan/utils/mealPlanPaging';
import {
  MAX_RECIPE_INGREDIENTS,
  RECIPE_INGREDIENTS_PAGE_SIZE,
} from '#domain/recipeIngredientsPaging';
import { t } from '#/i18n';
import { act } from '@testing-library/react-native';
import { useGenerateShoppingList } from '../useGenerateShoppingList';

/**
 * The list is built from the cached plan, so these assert on what the hook
 * SENDS: the plan never reaches the server, and the same plan offline and
 * online has to produce the same two writes.
 */

const PLAN_ID = 'plan-1';

const ingredient = (id: string, itemId: string, quantity: number) => ({
  __typename: 'RecipeIngredientEdge',
  node: {
    __typename: 'RecipeIngredient',
    id,
    name: `Ingredient ${id}`,
    quantity,
    isOptional: false,
    // The id alone is cached: the derive keys on it and sends it back.
    unit: { __typename: 'Unit', id: 'unit-1' },
    item: { __typename: 'Item', id: itemId, name: `Item ${itemId}` },
  },
});

const RECIPE_NAME = 'Sunday Stew';

/**
 * A recipe's ingredient lines as one cached list: whole unless the recipe is
 * over the ingredient limit, which `hasNextPage` marks.
 */
const ingredientsOf = (
  ingredients: unknown[],
  hasNextPage: boolean = false,
) => ({
  __typename: 'RecipeIngredientConnection',
  pageInfo: {
    __typename: 'PageInfo',
    hasNextPage,
    endCursor: hasNextPage ? 'cursor-next' : null,
  },
  totalCount: ingredients.length,
  edges: ingredients,
});

/** A meal cooking `recipe-1`, which serves two, with these ingredient lines. */
const recipeMeal = (
  ingredients: unknown[],
  servings: number = 4,
  { overLimit = false }: { overLimit?: boolean } = {},
) => ({
  __typename: 'MealPlanItem',
  id: 'mpi-1',
  servings,
  recipe: {
    __typename: 'Recipe',
    id: 'recipe-1',
    name: RECIPE_NAME,
    servings: 2,
    ingredientsConnection: ingredientsOf(ingredients, overLimit),
  },
});

const PLAN_NAME = 'Week One';

/** The plan as `GetMealPlan` caches it: each meal an edge of one list. */
const planOf = (meals: unknown[], hasNextPage: boolean = false) => ({
  __typename: 'MealPlan',
  id: PLAN_ID,
  name: PLAN_NAME,
  homeId: 'home-1',
  mealPlanItemsConnection: {
    __typename: 'MealPlanItemConnection',
    pageInfo: { __typename: 'PageInfo', hasNextPage },
    totalCount: meals.length,
    edges: meals.map(node => ({ __typename: 'MealPlanItemEdge', node })),
  },
});

/**
 * One meal whose recipe is cached with two ingredients, and one whose recipe is
 * not — the case the derive has to degrade per source rather than per action.
 */
const twoMeals = [
  recipeMeal([
    ingredient('ri-1', 'item-1', 3),
    ingredient('ri-2', 'item-2', 1),
  ]),
  { __typename: 'MealPlanItem', id: 'mpi-2', servings: 2, recipe: null },
];

const seedPlan = (plan: ReturnType<typeof planOf>) =>
  seedCache([
    {
      data: plan,
      fragment: UseGenerateShoppingList_MealPlanFragmentDoc,
      fragmentName: 'useGenerateShoppingList_mealPlan',
    },
  ]);

function createMock() {
  return recordMock(CreateShoppingListDocument, {
    data: {
      createShoppingList: {
        __typename: 'CreateShoppingListPayload',
        shoppingList: { __typename: 'ShoppingList', id: 'list-1' },
      },
    },
    partial: true,
  });
}

function addMock() {
  return recordMock(AddDerivedItemsToShoppingListDocument, {
    data: {
      addItemsToShoppingList: {
        __typename: 'AddItemsToShoppingListPayload',
        results: [],
      },
    },
    partial: true,
  });
}

function linkMock() {
  return recordMock(LinkDerivedListToMealPlanDocument, {
    data: {
      linkShoppingListToMealPlan: {
        __typename: 'LinkShoppingListToMealPlanPayload',
        shoppingList: { __typename: 'ShoppingList', id: 'list-1' },
      },
    },
    partial: true,
  });
}

describe('generating a shopping list from a cached meal plan', () => {
  afterEach(() => {
    useStore.setState({ apiReachable: true, isOnline: true });
    memoryScreen().setFocused(true);
    jest.clearAllMocks();
  });

  it('refuses when the plan is not in the cache, without firing anything', async () => {
    const create = createMock();
    const add = addMock();
    const { result } = renderHookWithApollo(
      () => useGenerateShoppingList(PLAN_ID),
      { operationMocks: [create.mock, add.mock] },
    );

    const response = await result.current.generateShoppingList({});

    expect(response).toBeNull();
    expect(create.fired).toHaveLength(0);
    expect(add.fired).toHaveLength(0);
    expect(toastService.error).toHaveBeenCalled();
  });

  it('refuses with no plan id at all', async () => {
    const create = createMock();
    const { result } = renderHookWithApollo(
      () => useGenerateShoppingList(null),
      { operationMocks: [create.mock] },
    );

    expect(await result.current.generateShoppingList({})).toBeNull();
    expect(create.fired).toHaveLength(0);
  });

  it('stands its pantry watcher down while the tab is blurred', () => {
    renderHookWithApollo(() => useGenerateShoppingList(PLAN_ID), {
      operationMocks: [],
    });
    expect(mockUsePantryQuery).toHaveBeenLastCalledWith(
      undefined,
      null,
      null,
      undefined,
      { skip: false, fetchPolicy: 'cache-only' },
    );

    act(() => memoryScreen().setFocused(false));

    expect(mockUsePantryQuery).toHaveBeenLastCalledWith(
      undefined,
      null,
      null,
      undefined,
      { skip: true, fetchPolicy: 'cache-only' },
    );
  });

  it('does not expose an offline gate — the action is derived, not requested', () => {
    useStore.setState({ apiReachable: false });
    const { result } = renderHookWithApollo(
      () => useGenerateShoppingList(PLAN_ID),
      { operationMocks: [] },
    );

    expect('isApiUnavailable' in result.current).toBe(false);
    expect(typeof result.current.generateShoppingList).toBe('function');
  });

  // A list derived from a first page alone would silently be a short one.
  it('refuses a plan whose later pages of meals are unread, without firing anything', async () => {
    const create = createMock();
    const add = addMock();
    const link = linkMock();
    const { result } = renderHookWithApollo(
      () => useGenerateShoppingList(PLAN_ID),
      {
        operationMocks: [create.mock, add.mock, link.mock],
        cache: seedPlan(planOf(twoMeals, true)),
      },
    );

    const response = await result.current.generateShoppingList({
      checkPantry: false,
    });

    expect(response).toBeNull();
    expect(create.fired).toHaveLength(0);
    expect(add.fired).toHaveLength(0);
    expect(link.fired).toHaveLength(0);
    expect(toastService.error).toHaveBeenCalledTimes(1);
    expect(toastService.error).toHaveBeenCalledWith(
      t('generateShoppingList.planNotLoaded'),
    );
    expect(toastService.success).not.toHaveBeenCalled();
  });

  // One page is all a recipe holds, so one that answers `hasNextPage` is over
  // the ingredient limit and the device has only part of it.
  it('refuses a plan with a recipe over the ingredient limit, without firing anything', async () => {
    const create = createMock();
    const add = addMock();
    const link = linkMock();
    const { result } = renderHookWithApollo(
      () => useGenerateShoppingList(PLAN_ID),
      {
        operationMocks: [create.mock, add.mock, link.mock],
        cache: seedPlan(
          planOf([
            recipeMeal(
              [
                ingredient('ri-1', 'item-1', 3),
                ingredient('ri-2', 'item-2', 1),
              ],
              4,
              { overLimit: true },
            ),
          ]),
        ),
      },
    );

    const response = await result.current.generateShoppingList({
      checkPantry: false,
    });

    expect(response).toBeNull();
    expect(create.fired).toHaveLength(0);
    expect(add.fired).toHaveLength(0);
    expect(link.fired).toHaveLength(0);
    expect(toastService.error).toHaveBeenCalledTimes(1);
    // Names the recipe and the limit: no refresh brings the rest in.
    expect(toastService.error).toHaveBeenCalledWith(
      `"${RECIPE_NAME}" has more than 100 ingredients, so it can't be added to a shopping list in full.`,
    );
    expect(toastService.success).not.toHaveBeenCalled();
  });

  it('derives the cached meals and skips the one with no recipe', async () => {
    useStore.setState({ apiReachable: false });
    const create = createMock();
    const add = addMock();
    const link = linkMock();
    const cache = seedPlan(planOf(twoMeals));

    const { result } = renderHookWithApollo(
      () => useGenerateShoppingList(PLAN_ID),
      { operationMocks: [create.mock, add.mock, link.mock], cache },
    );

    const response = await result.current.generateShoppingList({
      checkPantry: false,
    });

    expect(response).toEqual({ shoppingListId: 'list-1', lineCount: 2 });
    expect(create.fired).toHaveLength(1);
    expect(add.fired).toHaveLength(1);

    // Two ingredients at double servings; the meal with no cached recipe
    // contributes nothing and does not stop the rest.
    const fired = add.fired[0] as {
      input?: {
        items?: Array<{
          quantity: number;
          recipeContext: Record<string, unknown>;
        }>;
      };
    };
    const items = fired?.input?.items ?? [];
    expect(items).toHaveLength(2);
    expect(items.map(i => i.quantity)).toEqual([6, 2]);
    // Each line names the plan and the meal it came from, as a meal-plan line.
    expect(items.map(i => i.recipeContext)).toEqual([
      {
        mealPlanId: PLAN_ID,
        mealPlanItemId: 'mpi-1',
        addedContext: AddedContext.FromMealPlan,
        recipeId: 'recipe-1',
        recipeIngredientId: 'ri-1',
      },
      {
        mealPlanId: PLAN_ID,
        mealPlanItemId: 'mpi-1',
        addedContext: AddedContext.FromMealPlan,
        recipeId: 'recipe-1',
        recipeIngredientId: 'ri-2',
      },
    ]);

    // The list records the plan it came from, which the fan-out did inside its
    // own transaction and a client-assembled list has to say separately.
    expect(link.fired).toHaveLength(1);
    expect(link.fired[0]).toMatchObject({
      input: { id: 'list-1', mealPlanId: PLAN_ID },
    });
  });

  describe('an ingredient the server has not linked yet', () => {
    // Straight after an import the plan caches the recipe with `item: null`;
    // the server links it on a background job.
    const unlinked = {
      ...ingredient('ri-2', 'item-2', 1),
      node: { ...ingredient('ri-2', 'item-2', 1).node, item: null },
    };
    const seedUnlinked = () =>
      seedPlan(
        planOf([recipeMeal([ingredient('ri-1', 'item-1', 3), unlinked])]),
      );
    // The server's answer, now linked, in the shape the re-read selects.
    const planMock = ({ overLimit = false } = {}) =>
      recordMock(GenerateShoppingListPlanDocument, {
        data: {
          mealPlan: {
            __typename: 'MealPlan',
            id: PLAN_ID,
            name: PLAN_NAME,
            homeId: 'home-1',
            mealPlanItemsConnection: {
              pageInfo: { hasNextPage: false },
              totalCount: 1,
              edges: [
                {
                  node: {
                    __typename: 'MealPlanItem',
                    id: 'mpi-1',
                    servings: 4,
                    recipe: {
                      __typename: 'Recipe',
                      id: 'recipe-1',
                      name: RECIPE_NAME,
                      servings: 2,
                      ingredientsConnection: {
                        __typename: 'RecipeIngredientConnection',
                        pageInfo: {
                          hasNextPage: overLimit,
                          endCursor: overLimit ? 'cursor-next' : null,
                        },
                        totalCount: 2,
                        edges: [
                          {
                            __typename: 'RecipeIngredientEdge',
                            node: {
                              __typename: 'RecipeIngredient',
                              id: 'ri-1',
                              name: 'Ingredient ri-1',
                              quantity: 3,
                              isOptional: false,
                              unit: { __typename: 'Unit', id: 'unit-1' },
                              item: {
                                __typename: 'Item',
                                id: 'item-1',
                                name: 'Item item-1',
                              },
                            },
                          },
                          {
                            __typename: 'RecipeIngredientEdge',
                            node: {
                              __typename: 'RecipeIngredient',
                              id: 'ri-2',
                              name: 'Ingredient ri-2',
                              quantity: 1,
                              isOptional: false,
                              unit: { __typename: 'Unit', id: 'unit-1' },
                              item: {
                                __typename: 'Item',
                                id: 'item-2',
                                name: 'Item item-2',
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      });

    it('re-reads the plan online and includes the linked ingredient', async () => {
      const refetch = planMock();
      const add = addMock();

      const { result } = renderHookWithApollo(
        () => useGenerateShoppingList(PLAN_ID),
        {
          operationMocks: [
            refetch.mock,
            createMock().mock,
            add.mock,
            linkMock().mock,
          ],
          cache: seedUnlinked(),
        },
      );

      const response = await result.current.generateShoppingList({
        checkPantry: false,
      });

      expect(refetch.fired).toEqual([
        {
          id: PLAN_ID,
          mealsFirst: MEALS_PAGE_SIZE,
          ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
        },
      ]);
      expect(response).toEqual({ shoppingListId: 'list-1', lineCount: 2 });
    });

    // The re-read restates a recipe's one page.
    it('refuses when the re-read finds the recipe grown past the ingredient limit', async () => {
      const create = createMock();
      const add = addMock();

      const { result } = renderHookWithApollo(
        () => useGenerateShoppingList(PLAN_ID),
        {
          operationMocks: [
            planMock({ overLimit: true }).mock,
            create.mock,
            add.mock,
            linkMock().mock,
          ],
          cache: seedUnlinked(),
        },
      );

      const response = await result.current.generateShoppingList({
        checkPantry: false,
      });

      expect(response).toBeNull();
      expect(create.fired).toHaveLength(0);
      expect(add.fired).toHaveLength(0);
      expect(toastService.error).toHaveBeenCalledWith(
        t('generateShoppingList.recipeOverLimit', {
          name: RECIPE_NAME,
          count: MAX_RECIPE_INGREDIENTS,
        }),
      );
    });

    it('builds from the cache offline and leaves it out', async () => {
      useStore.setState({ apiReachable: false });
      const refetch = planMock();

      const { result } = renderHookWithApollo(
        () => useGenerateShoppingList(PLAN_ID),
        {
          operationMocks: [
            refetch.mock,
            createMock().mock,
            addMock().mock,
            linkMock().mock,
          ],
          cache: seedUnlinked(),
        },
      );

      const response = await result.current.generateShoppingList({
        checkPantry: false,
      });

      expect(refetch.fired).toHaveLength(0);
      expect(response).toEqual({ shoppingListId: 'list-1', lineCount: 1 });
    });
  });

  describe('a derive the API takes in more than one batch', () => {
    const seedBig = (lines: number) =>
      seedPlan(
        planOf([
          recipeMeal(
            Array.from({ length: lines }, (_, i) =>
              ingredient(`ri-${i}`, `item-${i}`, 1),
            ),
            2,
          ),
        ]),
      );
    const cachedRows = (cache: ReturnType<typeof seedCache>) =>
      Object.keys(cache.extract()).filter(key =>
        key.startsWith('ShoppingListItem:'),
      );

    it('sends 63 lines as batches the API accepts and reports all of them', async () => {
      useStore.setState({ apiReachable: false });
      const add = addMock();

      const { result } = renderHookWithApollo(
        () => useGenerateShoppingList(PLAN_ID),
        {
          operationMocks: [createMock().mock, add.mock, linkMock().mock],
          cache: seedBig(63),
        },
      );

      const response = await result.current.generateShoppingList({
        checkPantry: false,
      });

      const sizes = (add.fired as Array<{ input: { items: unknown[] } }>).map(
        fired => fired.input.items.length,
      );
      expect(sizes).toEqual([50, 13]);
      expect(response).toEqual({ shoppingListId: 'list-1', lineCount: 63 });
      expect(toastService.success).toHaveBeenCalledTimes(1);
      expect(toastService.success).toHaveBeenCalledWith(
        t('generateShoppingList.createdSuccess', {
          name: t('generateShoppingList.defaultName', { name: PLAN_NAME }),
          count: 63,
          shared: '',
        }),
      );
    });

    it('takes back the rows of a refused batch and reports no success', async () => {
      useStore.setState({ apiReachable: false });
      const refused = recordMock(AddDerivedItemsToShoppingListDocument, {
        data: {
          addItemsToShoppingList: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            message: 'guest',
          },
        },
      });
      const cache = seedBig(3);

      const { result } = renderHookWithApollo(
        () => useGenerateShoppingList(PLAN_ID),
        {
          operationMocks: [createMock().mock, refused.mock, linkMock().mock],
          cache,
        },
      );

      const response = await result.current.generateShoppingList({
        checkPantry: false,
        shoppingListId: 'list-1',
      });

      expect(refused.fired).toHaveLength(1);
      expect(cachedRows(cache)).toEqual([]);
      expect(response).toBeNull();
      expect(toastService.success).not.toHaveBeenCalled();
      expect(toastService.error).toHaveBeenCalled();
    });
  });
});
