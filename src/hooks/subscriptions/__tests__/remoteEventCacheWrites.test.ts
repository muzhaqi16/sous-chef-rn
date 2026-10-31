'use no memo';

/**
 * What a live event from another device leaves in the REAL cache: the entity is
 * read back complete before it is linked, and a create joins only the filtered
 * list variants it matches.
 */
import { act } from '@testing-library/react-native';
import {
  gql,
  type InMemoryCache,
  type TypedDocumentNode,
} from '@apollo/client';
import { useApolloClient, useQuery } from '@apollo/client/react';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import type { SubscriptionConfig } from '#/services/subscriptions/types';
import {
  MealPlanSubtype,
  MealPlanType,
  MutationType,
  PantrySubtype,
  ShoppingListSubtype,
  StorageState,
} from '#/graphql/generated/schemaTypes';
import { useStore } from '#store/index';
import { usePantrySubscriptions } from '#features/pantry/hooks/usePantrySubscriptions';
import { PantryItemsForEventsDocument } from '#features/pantry/hooks/usePantrySubscriptions.generated';
import { useMealPlanSubscriptions } from '#features/mealPlan/hooks/useMealPlanSubscriptions';
import { MealPlanForEventDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { GetMealPlanDocument } from '#features/mealPlan/screens/useMealPlan.generated';
import { useMealPlan } from '#features/mealPlan/screens/useMealPlan';
import { MEALS_PAGE_SIZE } from '#features/mealPlan/utils/mealPlanPaging';
import { RECIPE_INGREDIENTS_PAGE_SIZE } from '#domain/recipeIngredientsPaging';
import { MealPlanMain_MealPlanFragmentDoc } from '#features/mealPlan/screens/MealPlanMain.generated';
import { GetMealTemplateDocument } from '#features/mealPlan/graphql/mealTemplate.generated';
import { MealTemplateItemsForEventDocument } from '#features/mealPlan/hooks/useMealPlanSubscriptions.generated';
import { useShoppingListSubscriptions } from '#features/shoppingList/hooks/useShoppingListSubscriptions';
import { ShoppingListItemsForEventsDocument } from '#features/shoppingList/hooks/useShoppingListSubscriptions.generated';
import { captureOnData } from '#/test-utils/subscriptionCapture';
import { typedConnectionOf } from '#/test-utils/fixtures/connectionOf';

jest.mock('#/services/auth/deviceId', () => ({
  getDeviceId: jest.fn(() => 'device_this'),
}));

const mockRegister = jest.fn();
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    register: (config: SubscriptionConfig) => mockRegister(config),
    isParentDeleting: () => false,
    isPendingDelete: () => false,
    hasPendingDeletes: () => false,
  },
}));

const onData = captureOnData(mockRegister);

/** MockLink answers on a timer; the read-back then resolves a microtask later. */
const settle = async () => {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      jest.advanceTimersByTime(50);
    });
  }
};

const PANTRY_VARIANT: TypedDocumentNode<
  {
    pantry: {
      __typename: 'Pantry';
      id: string;
      itemsConnection: {
        __typename: 'PantryItemConnection';
        edges: Array<{
          __typename: 'PantryItemEdge';
          node: { __typename: 'PantryItem'; id: string };
        }>;
        totalCount: number;
      };
    } | null;
  },
  { id: string; filters?: Record<string, unknown> }
> = gql`
  query TestPantryVariant($id: ID!, $filters: PantryItemFilters) {
    pantry(id: $id) {
      id
      itemsConnection(first: 20, filters: $filters) {
        edges {
          node {
            id
          }
        }
        totalCount
      }
    }
  }
`;

const MEAL_PLANS_VARIANT: TypedDocumentNode<
  {
    mealPlans: {
      __typename: 'MealPlanConnection';
      edges: Array<{
        __typename: 'MealPlanEdge';
        node: { __typename: 'MealPlan'; id: string };
      }>;
      totalCount: number;
    };
  },
  { filters?: Record<string, unknown> }
> = gql`
  query TestMealPlansVariant($filters: MealPlanFilters) {
    mealPlans(first: 20, filters: $filters) {
      edges {
        node {
          id
        }
      }
      totalCount
    }
  }
`;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('a pantry item created elsewhere', () => {
  const PANTRY_VARIANTS: Record<string, Record<string, unknown> | undefined> = {
    all: undefined,
    fridge: { storageState: StorageState.Refrigerated },
    freezer: { storageState: StorageState.Frozen },
    shelf: { storageLocationId: 'loc-1' },
    otherShelf: { storageLocationId: 'loc-2' },
    search: { search: 'milk' },
  };

  it('joins only the location variants it matches, never a search', async () => {
    useStore.setState({
      selectedPantryId: 'pantry-1',
      isHomeSelectionReady: true,
    });
    const cache = makeCache();
    for (const filters of Object.values(PANTRY_VARIANTS)) {
      seedQuery(cache, {
        query: PANTRY_VARIANT,
        variables: { id: 'pantry-1', filters },
        data: {
          pantry: {
            __typename: 'Pantry',
            id: 'pantry-1',
            itemsConnection: {
              __typename: 'PantryItemConnection',
              edges: [],
              totalCount: 0,
            },
          },
        },
      });
    }
    const readBack = recordMock(PantryItemsForEventsDocument, {
      data: {
        pantryItemsByIds: [
          {
            id: 'item-new',
            pantryId: 'pantry-1',
            storageState: StorageState.Refrigerated,
            storageLocation: { id: 'loc-1' },
          },
        ],
      },
    });
    const { result } = renderHookWithApollo(
      () => {
        usePantrySubscriptions('user-1');
        return useApolloClient();
      },
      { cache, operationMocks: [readBack.mock] },
    );

    await act(async () => {
      onData()(
        {
          subtype: PantrySubtype.ItemChanged,
          mutation: MutationType.ItemAdded,
          pantryId: 'pantry-1',
          actorUserId: 'user-2',
          originatorClientId: 'device_other',
          node: { __typename: 'PantryItem', id: 'item-new' },
        },
        result.current,
      );
    });
    await settle();
    await drainTimers();
    expect(readBack.fired).toHaveLength(1);
    await settle();

    const idsIn = (filters: Record<string, unknown> | undefined) =>
      cache
        .readQuery({
          query: PANTRY_VARIANT,
          variables: { id: 'pantry-1', filters },
        })
        ?.pantry?.itemsConnection.edges.map(edge => edge.node.id);

    expect(idsIn(PANTRY_VARIANTS.all)).toEqual(['item-new']);
    expect(idsIn(PANTRY_VARIANTS.fridge)).toEqual(['item-new']);
    expect(idsIn(PANTRY_VARIANTS.shelf)).toEqual(['item-new']);
    expect(idsIn(PANTRY_VARIANTS.freezer)).toEqual([]);
    expect(idsIn(PANTRY_VARIANTS.otherShelf)).toEqual([]);
    expect(idsIn(PANTRY_VARIANTS.search)).toEqual([]);
  });
});

describe('a meal plan created elsewhere', () => {
  const PLAN_VARIANTS: Record<string, Record<string, unknown> | undefined> = {
    all: undefined,
    weekly: { planType: MealPlanType.Weekly },
    daily: { planType: MealPlanType.Daily },
    search: { search: 'week' },
  };

  it('joins only the plan-type variants it matches, never a search', async () => {
    useStore.setState({ selectedHomeId: 'home-1', isHomeSelectionReady: true });
    const cache = makeCache();
    for (const filters of Object.values(PLAN_VARIANTS)) {
      seedQuery(cache, {
        query: MEAL_PLANS_VARIANT,
        variables: { filters },
        data: {
          mealPlans: {
            __typename: 'MealPlanConnection',
            edges: [],
            totalCount: 0,
          },
        },
      });
    }
    const readBack = recordMock(MealPlanForEventDocument, {
      data: {
        mealPlan: { id: 'plan-new', planType: MealPlanType.Weekly },
      },
    });
    const { result } = renderHookWithApollo(
      () => {
        useMealPlanSubscriptions('user-1');
        return useApolloClient();
      },
      { cache, operationMocks: [readBack.mock] },
    );

    await act(async () => {
      onData()(
        {
          subtype: MealPlanSubtype.MealPlanChanged,
          mutation: MutationType.Created,
          mealPlanId: 'plan-new',
          actorUserId: 'user-2',
          originatorClientId: 'device_other',
          node: { __typename: 'MealPlan', id: 'plan-new' },
        },
        result.current,
      );
    });
    await settle();
    await drainTimers();
    expect(readBack.fired).toHaveLength(1);
    await settle();

    const idsIn = (filters: Record<string, unknown> | undefined) =>
      cache
        .readQuery({ query: MEAL_PLANS_VARIANT, variables: { filters } })
        ?.mealPlans.edges.map(edge => edge.node.id);

    expect(idsIn(PLAN_VARIANTS.all)).toEqual(['plan-new']);
    expect(idsIn(PLAN_VARIANTS.weekly)).toEqual(['plan-new']);
    expect(idsIn(PLAN_VARIANTS.daily)).toEqual([]);
    expect(idsIn(PLAN_VARIANTS.search)).toEqual([]);
  });
});

describe('a meal-template item added elsewhere', () => {
  it('reaches the open template complete, without blanking it or refetching it whole', async () => {
    useStore.setState({ selectedHomeId: 'home-1', isHomeSelectionReady: true });
    const wholePage = { hasNextPage: false, endCursor: null };
    const template = recordMock(GetMealTemplateDocument, {
      data: {
        mealTemplate: {
          id: 'tpl-1',
          itemsConnection: {
            edges: [{ node: { id: 'item-1' } }],
            pageInfo: wholePage,
          },
        },
      },
    });
    const readBack = recordMock(MealTemplateItemsForEventDocument, {
      data: {
        mealTemplate: {
          id: 'tpl-1',
          itemsConnection: {
            edges: [{ node: { id: 'item-1' } }, { node: { id: 'item-2' } }],
            pageInfo: wholePage,
          },
        },
      },
    });

    const renders: Array<string[] | undefined> = [];
    const { result } = renderHookWithApollo(
      () => {
        useMealPlanSubscriptions('user-1');
        const { data } = useQuery(GetMealTemplateDocument, {
          variables: { id: 'tpl-1', itemsFirst: MEALS_PAGE_SIZE },
        });
        const ids = data?.mealTemplate?.itemsConnection.edges.map(
          edge => edge.node.id,
        );
        renders.push(ids);
        return { client: useApolloClient(), ids };
      },
      { operationMocks: [template.mock, readBack.mock] },
    );
    await settle();
    await drainTimers();
    expect(result.current.ids).toEqual(['item-1']);
    const firstLoaded = renders.findIndex(ids => ids !== undefined);

    await act(async () => {
      onData()(
        {
          subtype: MealPlanSubtype.MealTemplateItemChanged,
          mutation: MutationType.ItemAdded,
          templateId: 'tpl-1',
          actorUserId: 'user-2',
          originatorClientId: 'device_other',
          node: { __typename: 'MealTemplateItem', id: 'item-2' },
        },
        result.current.client,
      );
    });
    await settle();

    // The read-back restates the first page of the same one list the screen
    // reads, so the new meal joins it as an edge.
    await drainTimers();
    expect(result.current.ids).toEqual(['item-1', 'item-2']);
    expect(readBack.fired).toEqual([
      { id: 'tpl-1', itemsFirst: MEALS_PAGE_SIZE },
    ]);
    // The screen's own query ran once, at mount, and never went empty after.
    expect(template.fired).toHaveLength(1);
    expect(renders.slice(firstLoaded)).not.toContain(undefined);
  });
});

describe('a meal removed elsewhere', () => {
  const planHolding = (
    ids: string[],
  ): MockDataFor<typeof GetMealPlanDocument> => ({
    mealPlan: {
      id: 'plan-1',
      mealPlanItemsConnection: {
        edges: ids.map(id => ({ node: { id } })),
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  });

  it('leaves the open plan at once, and the plan is read again for its totals', async () => {
    useStore.setState({ selectedHomeId: 'home-1', isHomeSelectionReady: true });
    const cache = makeCache();
    const opened = recordMock(GetMealPlanDocument, {
      data: planHolding(['meal-1', 'meal-2']),
      maxUsageCount: 1,
    });
    const reRead = recordMock(GetMealPlanDocument, {
      data: planHolding(['meal-2']),
    });
    const { result } = renderHookWithApollo(
      () => {
        useMealPlanSubscriptions('user-1');
        const { items } = useMealPlan('plan-1');
        return { client: useApolloClient(), ids: items.map(item => item.id) };
      },
      { cache, operationMocks: [opened.mock, reRead.mock] },
    );
    await settle();
    await drainTimers();
    expect(result.current.ids).toEqual(['meal-1', 'meal-2']);

    await act(async () => {
      onData()(
        {
          subtype: MealPlanSubtype.MealPlanItemChanged,
          mutation: MutationType.ItemRemoved,
          mealPlanId: 'plan-1',
          actorUserId: 'user-2',
          originatorClientId: 'device_other',
          node: { __typename: 'MealPlanItem', id: 'meal-1' },
        },
        result.current.client,
      );
    });

    // Its edge is off the plan's meals and its record gone, before any read.
    expect(
      cache
        .readFragment({
          id: cache.identify({ __typename: 'MealPlan', id: 'plan-1' }),
          fragment: MealPlanMain_MealPlanFragmentDoc,
          fragmentName: 'MealPlanMain_mealPlan',
        })
        ?.mealPlanItemsConnection.edges.map(edge => edge.node.id),
    ).toEqual(['meal-2']);
    expect(cache.extract()['MealPlanItem:meal-1']).toBeUndefined();
    expect(reRead.fired).toHaveLength(0);

    // The debounced plan read restates what only the server computes.
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await settle();
    await drainTimers();
    expect(reRead.fired).toEqual([
      {
        id: 'plan-1',
        mealsFirst: MEALS_PAGE_SIZE,
        ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
      },
    ]);
    await drainTimers();
    expect(result.current.ids).toEqual(['meal-2']);
  });
});

interface ListEdge {
  __typename: 'ShoppingListItemEdge';
  node: { __typename: 'ShoppingListItem'; id: string };
}

interface ListVariant {
  shoppingList: {
    __typename: 'ShoppingList';
    id: string;
    totalItems: number;
    completedItems: number;
    remainingItems: number;
    completionRate: number;
    itemsConnection: {
      __typename: 'ShoppingListItemConnection';
      totalCount: number;
      edges: ListEdge[];
    };
  } | null;
}

const LIST_VARIANT: TypedDocumentNode<
  ListVariant,
  { id: string; isPurchased: boolean }
> = gql`
  query TestShoppingListVariant($id: ID!, $isPurchased: Boolean) {
    shoppingList(id: $id) {
      id
      totalItems
      completedItems
      remainingItems
      completionRate
      itemsConnection(first: 20, filters: { isPurchased: $isPurchased }) {
        totalCount
        edges {
          node {
            id
          }
        }
      }
    }
  }
`;

/** `list-1` holding two rows, neither bought. */
function seedList(): InMemoryCache {
  const cache = makeCache();
  const variant = (isPurchased: boolean, ids: string[]) =>
    seedQuery(cache, {
      query: LIST_VARIANT,
      variables: { id: 'list-1', isPurchased },
      data: {
        shoppingList: {
          __typename: 'ShoppingList',
          id: 'list-1',
          totalItems: 2,
          completedItems: 0,
          remainingItems: 2,
          completionRate: 0,
          itemsConnection: typedConnectionOf(
            'ShoppingListItem',
            ids.map((id): ListEdge['node'] => ({
              __typename: 'ShoppingListItem',
              id,
            })),
          ),
        },
      },
    });
  variant(false, ['item-1', 'item-2']);
  variant(true, []);
  return cache;
}

const read = (cache: InMemoryCache, isPurchased: boolean) => {
  const list = cache.readQuery({
    query: LIST_VARIANT,
    variables: { id: 'list-1', isPurchased },
  })?.shoppingList;
  return {
    ids: list?.itemsConnection.edges.map(edge => edge.node.id),
    totalCount: list?.itemsConnection.totalCount,
  };
};

const counters = (cache: InMemoryCache) => {
  const list = cache.readQuery({
    query: LIST_VARIANT,
    variables: { id: 'list-1', isPurchased: false },
  })?.shoppingList;
  return {
    totalItems: list?.totalItems,
    completedItems: list?.completedItems,
    remainingItems: list?.remainingItems,
    completionRate: list?.completionRate,
  };
};

/** The row as the server holds it after the transition, for the read-back. */
const rowReadBack = (isPurchased: boolean) =>
  recordMock(ShoppingListItemsForEventsDocument, {
    data: {
      shoppingListItemsByIds: [
        {
          id: 'item-1',
          shoppingList: { id: 'list-1' },
          purchaseInfo: { isPurchased },
        },
      ],
    },
    maxUsageCount: 1,
  });

// The event names the transition and the row, never the operation that caused
// it, so the row and the list's counters move whichever mutation the sender used.
describe('a row ticked off, then back on, by another member', () => {
  beforeEach(() => useStore.setState({ selectedShoppingListId: 'list-1' }));
  afterEach(() => useStore.setState({ selectedShoppingListId: null }));

  it('moves between the purchased variants and moves the list counters each time', async () => {
    const cache = seedList();
    const bought = rowReadBack(true);
    const unbought = rowReadBack(false);
    const { result } = renderHookWithApollo(
      () => {
        useShoppingListSubscriptions('user-1');
        return useApolloClient();
      },
      { cache, operationMocks: [bought.mock, unbought.mock] },
    );

    const announce = async (mutation: MutationType) => {
      await act(async () => {
        onData()(
          {
            subtype: ShoppingListSubtype.ItemsChanged,
            mutation,
            listId: 'list-1',
            actorUserId: 'user-2',
            originatorClientId: 'device_other',
            // What the API states for either direction of the transition.
            updatedFields: ['purchased'],
            node: { __typename: 'ShoppingListItem', id: 'item-1' },
          },
          result.current,
        );
      });
      await settle();
    };

    await announce(MutationType.ItemCompleted);
    await drainTimers();
    expect(bought.fired).toEqual([{ ids: ['item-1'] }]);
    await settle();

    expect(read(cache, false)).toEqual({ ids: ['item-2'], totalCount: 1 });
    expect(read(cache, true)).toEqual({ ids: ['item-1'], totalCount: 1 });
    expect(counters(cache)).toEqual({
      totalItems: 2,
      completedItems: 1,
      remainingItems: 1,
      completionRate: 0.5,
    });

    await announce(MutationType.ItemUncompleted);
    await drainTimers();
    expect(unbought.fired).toEqual([{ ids: ['item-1'] }]);
    await settle();

    expect(read(cache, false)).toEqual({
      ids: ['item-1', 'item-2'],
      totalCount: 2,
    });
    expect(read(cache, true)).toEqual({ ids: [], totalCount: 0 });
    expect(counters(cache)).toEqual({
      totalItems: 2,
      completedItems: 0,
      remainingItems: 2,
      completionRate: 0,
    });
  });
});
