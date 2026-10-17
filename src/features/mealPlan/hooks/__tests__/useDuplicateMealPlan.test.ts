'use no memo';

import type { InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  CreateMealPlanDocument,
  CreateMealPlanItemDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import {
  UseDuplicateMealPlan_MealPlanFragmentDoc,
  type UseDuplicateMealPlan_MealPlanFragment,
} from '#features/mealPlan/hooks/useDuplicateMealPlan.generated';
import { MealPlanMain_MealPlanFragmentDoc } from '#features/mealPlan/screens/MealPlanMain.generated';
import {
  ErrorCode,
  MealPlanType,
  MealType,
} from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { useStore } from '#store';
import { useDuplicateMealPlan } from '../useDuplicateMealPlan';

/**
 * A duplicate is a create plus one create per meal, so these assert on the
 * CACHE and on what is sent — the source plan never leaves the device. Every
 * day is a `LocalDate` key.
 */

const SOURCE_ID = 'plan-1';

/** The source as `GetMealPlan` caches it: every meal an edge of one list. */
const sourcePlan = (
  hasNextPage: boolean = false,
): UseDuplicateMealPlan_MealPlanFragment => ({
  __typename: 'MealPlan',
  id: SOURCE_ID,
  description: 'A week of food',
  planType: MealPlanType.Weekly,
  servings: 4,
  budgetAmount: 90,
  homeId: 'home-1',
  startDate: '2026-01-05',
  endDate: '2026-01-11',
  mealPlanItemsConnection: {
    __typename: 'MealPlanItemConnection',
    totalCount: 2,
    pageInfo: { __typename: 'PageInfo', hasNextPage },
    edges: [
      {
        __typename: 'MealPlanItemEdge',
        node: {
          __typename: 'MealPlanItem',
          id: 'mpi-1',
          date: '2026-01-05',
          mealType: MealType.Dinner,
          servings: 2,
          notes: null,
          customMealName: null,
          recipe: { __typename: 'Recipe', id: 'recipe-1' },
        },
      },
      {
        __typename: 'MealPlanItemEdge',
        node: {
          __typename: 'MealPlanItem',
          id: 'mpi-2',
          date: '2026-01-07',
          mealType: MealType.Lunch,
          servings: null,
          notes: null,
          customMealName: 'Leftovers',
          recipe: null,
        },
      },
    ],
  },
});

const nextWeek = {
  mealPlanId: SOURCE_ID,
  newName: 'Week Two',
  newStartDate: '2026-01-12',
  newEndDate: '2026-01-18',
};

const createPlanMock = () =>
  recordMock(CreateMealPlanDocument, {
    data: {
      createMealPlan: {
        __typename: 'CreateMealPlanPayload',
        mealPlan: { __typename: 'MealPlan', id: 'copy-1' },
      },
    },
    partial: true,
  });

const createItemMock = () =>
  recordMock(CreateMealPlanItemDocument, {
    data: {
      createMealPlanItem: {
        __typename: 'CreateMealPlanItemPayload',
        mealPlanItem: { __typename: 'MealPlanItem', id: 'copy-item' },
      },
    },
    partial: true,
  });

const seeded = (source = sourcePlan()): InMemoryCache => {
  const cache = makeCache();
  cache.writeFragment({
    id: cache.identify(source),
    fragment: UseDuplicateMealPlan_MealPlanFragmentDoc,
    fragmentName: 'useDuplicateMealPlan_mealPlan',
    data: source,
  });
  return cache;
};

/** The ids of a plan's meals as the detail screen reads them, or null. */
const mealsOnScreen = (cache: InMemoryCache, planId: string | null) =>
  cache
    .readFragment({
      id: cache.identify({ __typename: 'MealPlan', id: planId ?? '' }),
      fragment: MealPlanMain_MealPlanFragmentDoc,
      fragmentName: 'MealPlanMain_mealPlan',
    })
    ?.mealPlanItemsConnection.edges.map(edge => edge.node.id) ?? null;

describe('duplicating a meal plan', () => {
  beforeEach(() => {
    // The optimistic plan write needs an auth identity to name its owner.
    useStore.setState({
      user: {
        id: 'user-1',
        email: 'a@b.c',
        displayName: 'A',
        emailVerified: true,
        onBoarded: true,
      },
    });
  });

  afterEach(() => {
    useStore.setState({ apiReachable: true, isOnline: true, user: null });
    jest.clearAllMocks();
  });

  it('refuses when the source plan is not cached, without firing anything', async () => {
    const plan = createPlanMock();
    const { result } = renderHookWithApollo(() => useDuplicateMealPlan(), {
      operationMocks: [plan.mock],
    });

    expect(await result.current.duplicatePlan(nextWeek)).toBeNull();
    expect(plan.fired).toHaveLength(0);
    expect(toastService.error).toHaveBeenCalled();
  });

  it('refuses a range of a different length without firing anything', async () => {
    const plan = createPlanMock();
    const { result } = renderHookWithApollo(() => useDuplicateMealPlan(), {
      operationMocks: [plan.mock],
      cache: seeded(),
    });

    const response = await result.current.duplicatePlan({
      ...nextWeek,
      newEndDate: '2026-01-19',
    });

    expect(response).toBeNull();
    expect(plan.fired).toHaveLength(0);
  });

  // A copy made from a first page alone would silently drop the other meals.
  it('refuses a plan whose later pages of meals are unread, without firing anything', async () => {
    const plan = createPlanMock();
    const item = createItemMock();
    const { result } = renderHookWithApollo(() => useDuplicateMealPlan(), {
      operationMocks: [plan.mock, item.mock],
      cache: seeded(sourcePlan(true)),
    });

    expect(await result.current.duplicatePlan(nextWeek)).toBeNull();
    expect(plan.fired).toHaveLength(0);
    expect(item.fired).toHaveLength(0);
    expect(toastService.error).toHaveBeenCalledTimes(1);
    expect(toastService.success).not.toHaveBeenCalled();
  });

  it('writes the copied plan to the cache offline and creates every meal', async () => {
    useStore.setState({ apiReachable: false });
    const plan = createPlanMock();
    const item = createItemMock();
    const cache = seeded();
    const { result } = renderHookWithApollo(() => useDuplicateMealPlan(), {
      operationMocks: [plan.mock, item.mock],
      cache,
    });

    const response = await result.current.duplicatePlan(nextWeek);

    expect(response?.mealCount).toBe(2);
    const copyId = response?.mealPlanId;
    expect(copyId).toBeTruthy();

    // The copy is in the cache under its minted id before any server round trip.
    expect(cache.extract()[`MealPlan:${copyId}`]).toMatchObject({
      name: 'Week Two',
      startDate: '2026-01-12',
      endDate: '2026-01-18',
    });
    expect(plan.fired).toEqual([
      {
        input: {
          id: copyId,
          name: 'Week Two',
          startDate: '2026-01-12',
          endDate: '2026-01-18',
          planType: MealPlanType.Weekly,
          description: 'A week of food',
          servings: 4,
          budgetAmount: 90,
          homeId: 'home-1',
        },
      },
    ]);

    // One create per meal, each parented to the copy and shifted by a week.
    expect(item.fired).toHaveLength(2);
    const sent = item.fired as Array<{
      input: { mealPlanId: string; date: string };
    }>;
    expect(sent.map(f => f.input.mealPlanId)).toEqual([copyId, copyId]);
    expect(sent.map(f => f.input.date)).toEqual(['2026-01-12', '2026-01-14']);
  });

  it('puts every copied meal on the new plan in the cache while queued', async () => {
    useStore.setState({ apiReachable: false });
    const queuedItem = recordMock(CreateMealPlanItemDocument, {
      data: { createMealPlanItem: null },
    });
    const cache = seeded();
    const { result } = renderHookWithApollo(() => useDuplicateMealPlan(), {
      operationMocks: [createPlanMock().mock, queuedItem.mock],
      cache,
    });

    const response = await result.current.duplicatePlan(nextWeek);

    const sentIds = (queuedItem.fired as Array<{ input: { id: string } }>).map(
      fired => fired.input.id,
    );
    expect(sentIds).toHaveLength(2);
    // Offline the new plan shows its meals only from these writes: the detail
    // screen reads the copy complete, with an edge per copied meal.
    expect(mealsOnScreen(cache, response?.mealPlanId ?? null)).toEqual(sentIds);
    for (const id of sentIds) {
      expect(cache.extract()[`MealPlanItem:${id}`]).toMatchObject({
        mealType: expect.any(String),
        version: 1,
      });
    }
    expect(
      sentIds.map(id => cache.extract()[`MealPlanItem:${id}`]?.date),
    ).toEqual(['2026-01-12', '2026-01-14']);
  });

  it('takes a refused meal back off the new plan', async () => {
    const refusedItem = recordMock(CreateMealPlanItemDocument, {
      data: {
        createMealPlanItem: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          message: 'out of range',
          field: 'date',
        },
      },
    });
    const cache = seeded();
    const { result } = renderHookWithApollo(() => useDuplicateMealPlan(), {
      operationMocks: [createPlanMock().mock, refusedItem.mock],
      cache,
    });

    await result.current.duplicatePlan(nextWeek);

    const refused = (refusedItem.fired as Array<{ input: { id: string } }>).map(
      fired => fired.input.id,
    );
    expect(refused).toHaveLength(2);
    for (const id of refused) {
      expect(cache.extract()[`MealPlanItem:${id}`]).toBeUndefined();
    }
    // Neither is left as an edge of any plan.
    expect(JSON.stringify(cache.extract())).not.toMatch(
      new RegExp(refused.map(id => `MealPlanItem:${id}`).join('|')),
    );
  });

  it('does not report success when a copied meal fails to save', async () => {
    const plan = createPlanMock();
    const failedItem = recordMock(CreateMealPlanItemDocument, {
      error: new Error('boom'),
    });
    const { result } = renderHookWithApollo(() => useDuplicateMealPlan(), {
      operationMocks: [plan.mock, failedItem.mock],
      cache: seeded(),
    });

    await result.current.duplicatePlan(nextWeek);

    expect(failedItem.fired).toHaveLength(2);
    expect(toastService.success).not.toHaveBeenCalled();
    expect(toastService.error).toHaveBeenCalledTimes(1);
  });

  it('does not expose an offline gate', () => {
    useStore.setState({ apiReachable: false });
    const { result } = renderHookWithApollo(() => useDuplicateMealPlan(), {
      operationMocks: [],
    });

    expect('isApiUnavailable' in result.current).toBe(false);
  });
});
