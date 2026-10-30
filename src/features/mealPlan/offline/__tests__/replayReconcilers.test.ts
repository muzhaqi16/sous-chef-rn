import { gql, type InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  DeleteMealPlanDocument,
  type DeleteMealPlanMutation,
} from '#features/mealPlan/graphql/mealPlan.generated';
import {
  DeleteMealTemplateDocument,
  type DeleteMealTemplateMutation,
} from '#features/mealPlan/graphql/mealTemplate.generated';
import {
  removeFromMealPlans,
  removeFromMealTemplates,
} from '#features/mealPlan/cache/removals';
import { REPLAY_RECONCILERS } from '#/apollo/offlineQueue/replayRegistry';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import {
  reconcileCreateMealPlanItemReplay,
  settleMealPlanDelete,
  settleMealTemplateDelete,
} from '../replayReconcilers';
import { seedFragment, seedQuery } from '#/test-utils/apolloMockProvider';

const PLAN_ID = 'plan-1';
const MINTED_ID = 'minted-meal-1';
const SERVER_ID = 'server-meal-1';

// Selected with its paging arguments, as every reader of a loaded plan does.
const PLAN_MEALS = gql`
  fragment TestPlanMeals on MealPlan {
    id
    mealPlanItemsConnection(first: $mealsFirst, after: $mealsAfter) {
      edges {
        node {
          id
          date
          version
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

type PlanMeals = {
  mealPlanItemsConnection: { edges: Array<{ node: { id: string } }> };
};

const meal = (id: string, version: number = 1) => ({
  __typename: 'MealPlanItem',
  id,
  date: '2026-09-29',
  version,
});

const seedPlan = (mealIds: string[]): InMemoryCache => {
  const cache = makeCache();
  seedFragment(cache, {
    id: cache.identify({ __typename: 'MealPlan', version: 1, id: PLAN_ID }),
    fragment: PLAN_MEALS,
    data: {
      __typename: 'MealPlan',
      version: 1,
      id: PLAN_ID,
      mealPlanItemsConnection: {
        __typename: 'MealPlanItemConnection',
        edges: mealIds.map(id => ({
          __typename: 'MealPlanItemEdge',
          node: meal(id),
        })),
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
      },
    },
  });
  return cache;
};

const planMealIds = (cache: InMemoryCache) =>
  cache
    .readFragment<PlanMeals>({
      id: cache.identify({ __typename: 'MealPlan', version: 1, id: PLAN_ID }),
      fragment: PLAN_MEALS,
    })
    ?.mealPlanItemsConnection.edges.map(({ node }) => node.id);

/** The version the server's own row is at: another device made and edited it. */
const SERVER_VERSION = 4;

/** What a replay's normalization writes before the reconciler runs. */
const writeServerMeal = (cache: InMemoryCache) =>
  seedFragment(cache, {
    id: cache.identify({
      __typename: 'MealPlanItem',
      version: 1,
      id: SERVER_ID,
    }),
    fragment: gql`
      fragment TestServerMeal on MealPlanItem {
        id
        date
        version
      }
    `,
    data: meal(SERVER_ID, SERVER_VERSION),
  });

const createVariables = {
  input: { id: MINTED_ID, mealPlanId: PLAN_ID, date: '2026-09-29' },
};
const createdAs = (id: string, version: number = SERVER_VERSION) => ({
  createMealPlanItem: {
    __typename: 'CreateMealPlanItemPayload',
    mealPlanItem: { __typename: 'MealPlanItem', id, version },
  },
});

describe('a replayed meal create the server converged onto a held meal', () => {
  it('is registered for CreateMealPlanItem', () => {
    expect(REPLAY_RECONCILERS.CreateMealPlanItem).toBe(
      reconcileCreateMealPlanItemReplay,
    );
  });

  it('withdraws the minted meal and shows the one the server kept', () => {
    const cache = seedPlan([MINTED_ID]);
    writeServerMeal(cache);

    reconcileCreateMealPlanItemReplay(
      cache,
      createVariables,
      createdAs(SERVER_ID),
    );

    expect(planMealIds(cache)).toEqual([SERVER_ID]);
    expect(cache.extract()[`MealPlanItem:${MINTED_ID}`]).toBeUndefined();
  });

  it('equals one application when it runs again', () => {
    const cache = seedPlan([MINTED_ID]);
    writeServerMeal(cache);

    reconcileCreateMealPlanItemReplay(
      cache,
      createVariables,
      createdAs(SERVER_ID),
    );
    const once = cache.extract();
    reconcileCreateMealPlanItemReplay(
      cache,
      createVariables,
      createdAs(SERVER_ID),
    );

    expect(cache.extract()).toEqual(once);
    expect(planMealIds(cache)).toEqual([SERVER_ID]);
  });

  it('keeps a meal the server created under its minted id', () => {
    const cache = seedPlan([MINTED_ID]);
    const adopt = jest.fn();

    reconcileCreateMealPlanItemReplay(
      cache,
      createVariables,
      createdAs(MINTED_ID, 1),
      adopt,
    );

    expect(planMealIds(cache)).toEqual([MINTED_ID]);
    expect(adopt).not.toHaveBeenCalled();
  });

  // An edit queued behind the create states the minted row's version; the row
  // it now lands on is at its own, and `updateMealPlanItem` refuses a stale one.
  it('moves the writes queued against the minted meal onto the kept one, at its version', () => {
    const cache = seedPlan([MINTED_ID]);
    writeServerMeal(cache);
    const adopt = jest.fn();

    reconcileCreateMealPlanItemReplay(
      cache,
      createVariables,
      createdAs(SERVER_ID),
      adopt,
    );

    expect(adopt).toHaveBeenCalledWith({
      mintedId: MINTED_ID,
      survivingId: SERVER_ID,
      version: SERVER_VERSION,
    });
  });
});

const PLANS_LIST = gql`
  query TestMealPlansList {
    mealPlans {
      edges {
        node {
          id
          name
        }
      }
      totalCount
    }
  }
`;

const TEMPLATES_LIST = gql`
  query TestMealTemplatesList {
    mealTemplates {
      edges {
        node {
          id
          name
        }
      }
      totalCount
    }
  }
`;

const seedList = (
  query: typeof PLANS_LIST,
  field: 'mealPlans' | 'mealTemplates',
  typename: 'MealPlan' | 'MealTemplate',
): InMemoryCache => {
  const cache = makeCache();
  seedQuery(cache, {
    query,
    data: {
      [field]: {
        __typename: `${typename}Connection`,
        totalCount: 2,
        edges: ['a', 'b'].map(id => ({
          __typename: `${typename}Edge`,
          node: { __typename: typename, id, name: `Name ${id}` },
        })),
      },
    },
  });
  return cache;
};

type ListRead = {
  [field in 'mealPlans' | 'mealTemplates']: {
    edges: Array<{ node: { id: string } }>;
    totalCount: number;
  };
};

/** A kill and relaunch: the store as persisted, into a fresh cache. */
const coldStart = (cache: InMemoryCache): InMemoryCache => {
  const restored = makeCache();
  restored.restore(cache.extract());
  return restored;
};

describe.each([
  {
    name: 'meal plan',
    query: PLANS_LIST,
    field: 'mealPlans' as const,
    typename: 'MealPlan' as const,
    removeLocally: removeFromMealPlans,
    settle: settleMealPlanDelete,
    operation: operationNameOf(DeleteMealPlanDocument),
    writeResponse: (cache: InMemoryCache, id: string) =>
      seedQuery(cache, {
        query: DeleteMealPlanDocument,
        variables: { input: { id } },
        data: {
          __typename: 'Mutation',
          deleteMealPlan: {
            __typename: 'DeleteMealPlanPayload',
            converged: false,
            mealPlan: { __typename: 'MealPlan', id },
          },
        } satisfies DeleteMealPlanMutation,
      }),
  },
  {
    name: 'meal template',
    query: TEMPLATES_LIST,
    field: 'mealTemplates' as const,
    typename: 'MealTemplate' as const,
    removeLocally: removeFromMealTemplates,
    settle: settleMealTemplateDelete,
    operation: operationNameOf(DeleteMealTemplateDocument),
    writeResponse: (cache: InMemoryCache, id: string) =>
      seedQuery(cache, {
        query: DeleteMealTemplateDocument,
        variables: { input: { id } },
        data: {
          __typename: 'Mutation',
          deleteMealTemplate: {
            __typename: 'DeleteMealTemplatePayload',
            converged: false,
            mealTemplate: { __typename: 'MealTemplate', id },
          },
        } satisfies DeleteMealTemplateMutation,
      }),
  },
])(
  'a $name delete whose response names the deleted row',
  ({
    query,
    field,
    typename,
    removeLocally,
    settle,
    operation,
    writeResponse,
  }) => {
    const readList = (cache: InMemoryCache) =>
      cache.readQuery<ListRead>({ query });

    it('is registered as the replay counterpart', () => {
      expect(REPLAY_RECONCILERS[operation]).toBe(settle);
    });

    it('does not revive the row through its { id } stub', () => {
      const cache = seedList(query, field, typename);
      removeLocally(cache, 'a', { evictItem: true });

      writeResponse(cache, 'a');
      const list = readList(cache)?.[field];

      expect(list?.edges.map(({ node }) => node.id)).toEqual(['b']);
      expect(list?.totalCount).toBe(1);
    });

    it('keeps the list readable when the delete replays after a cold start', () => {
      const cache = seedList(query, field, typename);
      removeLocally(cache, 'a', { evictItem: true });
      const relaunched = coldStart(cache);

      writeResponse(relaunched, 'a');
      settle(relaunched, { input: { id: 'a' } }, undefined);

      expect(
        readList(relaunched)?.[field].edges.map(({ node }) => node.id),
      ).toEqual(['b']);
      expect(relaunched.extract()[`${typename}:a`]).toBeUndefined();
    });

    it('equals one application when it runs again', () => {
      const cache = seedList(query, field, typename);
      writeResponse(cache, 'a');
      settle(cache, { input: { id: 'a' } }, undefined);
      const once = cache.extract();

      settle(cache, { input: { id: 'a' } }, undefined);

      expect(cache.extract()).toEqual(once);
      expect(readList(cache)?.[field].totalCount).toBe(1);
    });
  },
);
