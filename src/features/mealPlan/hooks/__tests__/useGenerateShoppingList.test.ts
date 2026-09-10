'use no memo';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#/services/toastService', () => ({
  toastService: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('#/services/telemetry', () => ({
  Telemetry: { trackEvent: jest.fn(), trackError: jest.fn() },
}));

import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  AddDerivedItemsToShoppingListDocument,
  LinkDerivedListToMealPlanDocument,
} from '#features/mealPlan/hooks/useGenerateShoppingList.generated';
import { CreateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { toastService } from '#/services/toastService';
import { seedCache } from '#/test-utils/apolloMockProvider';
import { UseGenerateShoppingList_MealPlanFragmentDoc } from '#features/mealPlan/hooks/useGenerateShoppingList.generated';
import { useStore } from '#store';
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
    unit: { __typename: 'Unit', id: 'unit-1', name: 'gram', symbol: 'g' },
    item: { __typename: 'Item', id: itemId, name: `Item ${itemId}` },
  },
});

/**
 * One meal whose recipe is cached with two ingredients, and one whose recipe is
 * not — the case the derive has to degrade per source rather than per action.
 */
const plan = {
  __typename: 'MealPlan',
  id: PLAN_ID,
  name: 'Week One',
  homeId: 'home-1',
  mealPlanItems: [
    {
      __typename: 'MealPlanItem',
      id: 'mpi-1',
      servings: 4,
      recipe: {
        __typename: 'Recipe',
        id: 'recipe-1',
        servings: 2,
        ingredientsConnection: {
          __typename: 'RecipeIngredientConnection',
          edges: [
            ingredient('ri-1', 'item-1', 3),
            ingredient('ri-2', 'item-2', 1),
          ],
        },
      },
    },
    {
      __typename: 'MealPlanItem',
      id: 'mpi-2',
      servings: 2,
      recipe: null,
    },
  ],
};

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

  it('does not expose an offline gate — the action is derived, not requested', () => {
    useStore.setState({ apiReachable: false });
    const { result } = renderHookWithApollo(
      () => useGenerateShoppingList(PLAN_ID),
      { operationMocks: [] },
    );

    expect('isApiUnavailable' in result.current).toBe(false);
    expect(typeof result.current.generateShoppingList).toBe('function');
  });

  it('derives the cached meals and skips the one with no recipe', async () => {
    useStore.setState({ apiReachable: false });
    const create = createMock();
    const add = addMock();
    const link = linkMock();
    const cache = seedCache([
      {
        data: plan,
        fragment: UseGenerateShoppingList_MealPlanFragmentDoc,
        fragmentName: 'useGenerateShoppingList_mealPlan',
      },
    ]);

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
          recipeContext: { mealPlanId: string };
        }>;
      };
    };
    const items = fired?.input?.items ?? [];
    expect(items).toHaveLength(2);
    expect(items.map(i => i.quantity)).toEqual([6, 2]);
    expect(items[0]?.recipeContext.mealPlanId).toBe(PLAN_ID);

    // The list records the plan it came from, which the fan-out did inside its
    // own transaction and a client-assembled list has to say separately.
    expect(link.fired).toHaveLength(1);
    expect(link.fired[0]).toMatchObject({
      input: { id: 'list-1', mealPlanId: PLAN_ID },
    });
  });
});
