'use no memo';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#/services/toastService', () => ({
  toastService: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  CreateMealPlanDocument,
  CreateMealPlanItemDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import { UseDuplicateMealPlan_MealPlanFragmentDoc } from '#features/mealPlan/hooks/useDuplicateMealPlan.generated';
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
 * CACHE and on what is sent — the source plan never leaves the device.
 */

const SOURCE_ID = 'plan-1';

const sourcePlan = {
  __typename: 'MealPlan',
  id: SOURCE_ID,
  description: 'A week of food',
  planType: MealPlanType.Weekly,
  servings: 4,
  budgetAmount: 90,
  homeId: 'home-1',
  startDate: '2026-01-05T00:00:00.000Z',
  endDate: '2026-01-11T00:00:00.000Z',
  mealPlanItems: [
    {
      __typename: 'MealPlanItem',
      id: 'mpi-1',
      date: '2026-01-05T00:00:00.000Z',
      mealType: MealType.Dinner,
      servings: 2,
      notes: null,
      customMealName: null,
      recipe: { __typename: 'Recipe', id: 'recipe-1' },
    },
    {
      __typename: 'MealPlanItem',
      id: 'mpi-2',
      date: '2026-01-07T00:00:00.000Z',
      mealType: MealType.Lunch,
      servings: null,
      notes: null,
      customMealName: 'Leftovers',
      recipe: null,
    },
  ],
};

const nextWeek = {
  mealPlanId: SOURCE_ID,
  newName: 'Week Two',
  newStartDate: '2026-01-12T00:00:00.000Z',
  newEndDate: '2026-01-18T00:00:00.000Z',
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

const seeded = () =>
  seedCache([
    {
      data: sourcePlan,
      fragment: UseDuplicateMealPlan_MealPlanFragmentDoc,
      fragmentName: 'useDuplicateMealPlan_mealPlan',
    },
  ]);

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
      newEndDate: '2026-01-19T00:00:00.000Z',
    });

    expect(response).toBeNull();
    expect(plan.fired).toHaveLength(0);
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
      startDate: '2026-01-12T00:00:00.000Z',
    });

    // One create per meal, each parented to the copy and shifted by a week.
    expect(item.fired).toHaveLength(2);
    const sent = item.fired as Array<{
      input: { mealPlanId: string; date: string };
    }>;
    expect(sent.map(f => f.input.mealPlanId)).toEqual([copyId, copyId]);
    expect(sent.map(f => f.input.date)).toEqual([
      '2026-01-12T00:00:00.000Z',
      '2026-01-14T00:00:00.000Z',
    ]);
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
    const copy = cache.extract()[`MealPlan:${response?.mealPlanId}`] as {
      mealPlanItems?: Array<{ __ref: string }>;
    };
    expect(copy.mealPlanItems?.map(ref => ref.__ref)).toEqual(
      sentIds.map(id => `MealPlanItem:${id}`),
    );
    for (const id of sentIds) {
      expect(cache.extract()[`MealPlanItem:${id}`]).toMatchObject({
        mealType: expect.any(String),
      });
    }
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
