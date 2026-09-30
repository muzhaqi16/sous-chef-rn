'use no memo';

/**
 * What a live event from another device leaves in the REAL cache: the entity is
 * read back complete before it is linked, and a create joins only the filtered
 * list variants it matches.
 */
import { act, waitFor } from '@testing-library/react-native';
import { gql, type TypedDocumentNode } from '@apollo/client';
import { useApolloClient, useQuery } from '@apollo/client/react';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import type { SubscriptionConfig } from '#/services/subscriptions/types';
import {
  MealPlanSubtype,
  MealPlanType,
  MutationType,
  PantrySubtype,
  StorageState,
} from '#/graphql/generated/schemaTypes';
import { useStore } from '#store/index';
import { usePantrySubscriptions } from '#features/pantry/hooks/usePantrySubscriptions';
import { PantryItemForEventDocument } from '#features/pantry/hooks/usePantrySubscriptions.generated';
import { useMealPlanSubscriptions } from '#features/mealPlan/hooks/useMealPlanSubscriptions';
import { MealPlanForEventDocument } from '#features/mealPlan/graphql/mealPlan.generated';
import { GetMealTemplateDocument } from '#features/mealPlan/graphql/mealTemplate.generated';
import { MealTemplateItemsForEventDocument } from '#features/mealPlan/hooks/useMealPlanSubscriptions.generated';

type CapturedOnData = (data: unknown, client: unknown) => void;

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

jest.mock('#/storage/deviceId', () => ({
  getDeviceId: jest.fn(() => 'device_this'),
}));

let mockOnData: CapturedOnData | undefined;
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    register: (config: SubscriptionConfig) => {
      mockOnData = config.customOnData as CapturedOnData | undefined;
      return {};
    },
    isPendingDelete: () => false,
    hasPendingDeletes: () => false,
  },
}));

const onData = (): CapturedOnData => {
  if (!mockOnData) throw new Error('customOnData was not captured');
  return mockOnData;
};

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
  mockOnData = undefined;
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
      cache.writeQuery({
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
    const readBack = recordMock(PantryItemForEventDocument, {
      data: {
        pantryItem: {
          __typename: 'PantryItem',
          id: 'item-new',
          pantryId: 'pantry-1',
          storageState: StorageState.Refrigerated,
          storageLocation: { __typename: 'StorageLocation', id: 'loc-1' },
        },
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
    await waitFor(() => expect(readBack.fired).toHaveLength(1));
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
      cache.writeQuery({
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
        mealPlan: {
          __typename: 'MealPlan',
          id: 'plan-new',
          planType: MealPlanType.Weekly,
        },
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
    await waitFor(() => expect(readBack.fired).toHaveLength(1));
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
    const template = recordMock(GetMealTemplateDocument, {
      data: {
        mealTemplate: {
          __typename: 'MealTemplate',
          id: 'tpl-1',
          items: [{ __typename: 'MealTemplateItem', id: 'item-1' }],
        },
      },
    });
    const readBack = recordMock(MealTemplateItemsForEventDocument, {
      data: {
        mealTemplate: {
          __typename: 'MealTemplate',
          id: 'tpl-1',
          items: [
            { __typename: 'MealTemplateItem', id: 'item-1' },
            {
              __typename: 'MealTemplateItem',
              id: 'item-2',
              customMealName: 'Soup',
              recipe: null,
            },
          ],
        },
      },
    });

    const renders: Array<string[] | undefined> = [];
    const { result } = renderHookWithApollo(
      () => {
        useMealPlanSubscriptions('user-1');
        const { data } = useQuery(GetMealTemplateDocument, {
          variables: { id: 'tpl-1' },
        });
        renders.push(data?.mealTemplate?.items.map(item => item.id));
        return { client: useApolloClient(), data };
      },
      { operationMocks: [template.mock, readBack.mock] },
    );
    await settle();
    await waitFor(() =>
      expect(result.current.data?.mealTemplate?.items).toHaveLength(1),
    );
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

    await waitFor(() =>
      expect(
        result.current.data?.mealTemplate?.items.map(item => item.id),
      ).toEqual(['item-1', 'item-2']),
    );
    expect(readBack.fired).toEqual([{ id: 'tpl-1' }]);
    // The screen's own query ran once, at mount, and never went empty after.
    expect(template.fired).toHaveLength(1);
    expect(renders.slice(firstLoaded)).not.toContain(undefined);
  });
});
