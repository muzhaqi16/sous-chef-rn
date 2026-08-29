import { act } from '@testing-library/react-native';

jest.mock('#/apollo/links/tokenScheduler');

jest.mock('#/services/toastService', () => ({
  toastService: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  CreateMealPlanDocument,
  UpdateMealPlanDocument,
  DeleteMealPlanDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import type { CreateMealPlanInput } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { useStore } from '#store';
import { useMealPlanActions } from '../useMealPlanActions';

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  useStore.setState({ apiReachable: true, isOnline: true });
});

describe('useMealPlanActions', () => {
  it('returns loading states all false initially', () => {
    const { result } = renderHookWithApollo(() => useMealPlanActions());

    expect(result.current.loading).toBe(false);
    expect(result.current.creating).toBe(false);
    expect(result.current.updating).toBe(false);
    expect(result.current.deleting).toBe(false);
  });

  it('createMealPlan calls mutation and returns data', async () => {
    const expectedPlan = {
      __typename: 'MealPlan',
      id: 'plan-1',
      name: 'Week Plan',
    };
    const successPayload = {
      __typename: 'CreateMealPlanPayload',
      mealPlan: expectedPlan,
    };
    const create = recordMock(CreateMealPlanDocument, {
      data: { createMealPlan: successPayload },
    });

    const { result } = renderHookWithApollo(() => useMealPlanActions(), {
      operationMocks: [create.mock],
    });

    let created: Awaited<ReturnType<typeof result.current.createMealPlan>> =
      null;
    await act(async () => {
      created = await result.current.createMealPlan({
        name: 'Week Plan',
        startDate: '2025-06-01',
        endDate: '2025-06-07',
      } as CreateMealPlanInput);
    });

    expect(created).toMatchObject({
      __typename: 'CreateMealPlanPayload',
      mealPlan: { id: 'plan-1', name: 'Week Plan' },
    });
    // Local-first: the hook mints a permanent cuid id into the input.
    expect(create.fired).toContainEqual({
      input: {
        name: 'Week Plan',
        startDate: '2025-06-01',
        endDate: '2025-06-07',
        id: expect.stringMatching(/^(?:[a-z][0-9a-z]{23,31}|[0-9a-fA-F]{24})$/),
      },
    });
  });

  it('createMealPlan returns null when mutation returns no data', async () => {
    const create = recordMock(CreateMealPlanDocument, {
      data: { createMealPlan: null },
    });

    const { result } = renderHookWithApollo(() => useMealPlanActions(), {
      operationMocks: [create.mock],
    });

    let created: Awaited<ReturnType<typeof result.current.createMealPlan>> =
      null;
    await act(async () => {
      created = await result.current.createMealPlan({
        name: 'X',
        startDate: '2025-06-01',
        endDate: '2025-06-07',
      } as CreateMealPlanInput);
    });

    expect(created).toBeNull();
  });

  it('updateMealPlan calls mutation with id and input', async () => {
    const update = recordMock(UpdateMealPlanDocument, {
      data: {
        updateMealPlan: {
          __typename: 'UpdateMealPlanPayload',
          mealPlan: {
            __typename: 'MealPlan',
            id: 'plan-1',
            name: 'Updated',
          },
        },
      },
    });

    const { result } = renderHookWithApollo(() => useMealPlanActions(), {
      operationMocks: [update.mock],
    });

    let updated: Awaited<ReturnType<typeof result.current.updateMealPlan>> =
      null;
    await act(async () => {
      updated = await result.current.updateMealPlan('plan-1', {
        name: 'Updated',
      });
    });

    expect(updated).toMatchObject({
      __typename: 'UpdateMealPlanPayload',
      mealPlan: { id: 'plan-1', name: 'Updated' },
    });
    expect(update.fired).toContainEqual({
      input: { id: 'plan-1', name: 'Updated' },
    });
  });

  it('deleteMealPlan returns true on success', async () => {
    const del = recordMock(DeleteMealPlanDocument, {
      data: {
        deleteMealPlan: {
          __typename: 'DeleteMealPlanPayload',
          mealPlan: { __typename: 'MealPlan', id: 'plan-1' },
        },
      },
    });

    const { result } = renderHookWithApollo(() => useMealPlanActions(), {
      operationMocks: [del.mock],
    });

    let deleted: boolean | undefined;
    await act(async () => {
      deleted = await result.current.deleteMealPlan('plan-1');
    });

    expect(deleted).toBe(true);
    expect(del.fired).toContainEqual({ input: { id: 'plan-1' } });
  });

  it('deleteMealPlan returns false on failure', async () => {
    const del = recordMock(DeleteMealPlanDocument, {
      data: {
        deleteMealPlan: {
          __typename: 'NotFoundError',
          code: 'NOT_FOUND',
          message: 'Meal plan not found',
        },
      },
    });

    const { result } = renderHookWithApollo(() => useMealPlanActions(), {
      operationMocks: [del.mock],
    });

    let deleted: boolean | undefined;
    await act(async () => {
      deleted = await result.current.deleteMealPlan('plan-1');
    });

    expect(deleted).toBe(false);
  });
  it('deleteMealPlan evicts the plan only once the server confirms', async () => {
    const cache = seedCache([
      { __typename: 'MealPlan', id: 'plan-1', name: 'Week Plan' },
    ]);
    const del = recordMock(DeleteMealPlanDocument, {
      data: {
        deleteMealPlan: {
          __typename: 'DeleteMealPlanPayload',
          mealPlan: { __typename: 'MealPlan', id: 'plan-1' },
        },
      },
    });

    const { result } = renderHookWithApollo(() => useMealPlanActions(), {
      operationMocks: [del.mock],
      cache,
    });

    expect(cache.extract()['MealPlan:plan-1']).toBeDefined();

    await act(async () => {
      await result.current.deleteMealPlan('plan-1');
    });

    expect(cache.extract()['MealPlan:plan-1']).toBeUndefined();
  });

  it('deleteMealPlan leaves the plan in the cache when the server refuses', async () => {
    const cache = seedCache([
      { __typename: 'MealPlan', id: 'plan-1', name: 'Week Plan' },
    ]);
    const del = recordMock(DeleteMealPlanDocument, {
      data: {
        deleteMealPlan: {
          __typename: 'NotFoundError',
          code: 'NOT_FOUND',
          message: 'Meal plan not found',
        },
      },
    });

    const { result } = renderHookWithApollo(() => useMealPlanActions(), {
      operationMocks: [del.mock],
      cache,
    });

    await act(async () => {
      await result.current.deleteMealPlan('plan-1');
    });

    expect(cache.extract()['MealPlan:plan-1']).toBeDefined();
  });

  describe('when the API is unavailable', () => {
    it('exposes isApiUnavailable, toasts, and skips every mutation', async () => {
      useStore.setState({ apiReachable: false });
      const create = recordMock(CreateMealPlanDocument, {
        data: {
          createMealPlan: {
            __typename: 'CreateMealPlanPayload',
            mealPlan: { __typename: 'MealPlan', id: 'plan-1', name: 'Nope' },
          },
        },
      });
      const update = recordMock(UpdateMealPlanDocument, {
        data: {
          updateMealPlan: {
            __typename: 'UpdateMealPlanPayload',
            mealPlan: { __typename: 'MealPlan', id: 'plan-1', name: 'Nope' },
          },
        },
      });
      const del = recordMock(DeleteMealPlanDocument, {
        data: {
          deleteMealPlan: {
            __typename: 'DeleteMealPlanPayload',
            mealPlan: { __typename: 'MealPlan', id: 'plan-1' },
          },
        },
      });

      const { result } = renderHookWithApollo(() => useMealPlanActions(), {
        operationMocks: [create.mock, update.mock, del.mock],
      });

      expect(result.current.isApiUnavailable).toBe(true);

      let created: unknown;
      let updated: unknown;
      let deleted: boolean | undefined;
      await act(async () => {
        created = await result.current.createMealPlan({
          name: 'Week Plan',
          startDate: '2025-06-01',
          endDate: '2025-06-07',
        } as CreateMealPlanInput);
        updated = await result.current.updateMealPlan('plan-1', {
          name: 'Updated',
        });
        deleted = await result.current.deleteMealPlan('plan-1');
      });

      expect(created).toBeNull();
      expect(updated).toBeNull();
      expect(deleted).toBe(false);
      expect(toastService.error).toHaveBeenCalledWith('Not available offline');
      expect(toastService.error).toHaveBeenCalledTimes(3);
      expect(create.fired).toHaveLength(0);
      expect(update.fired).toHaveLength(0);
      expect(del.fired).toHaveLength(0);
    });
  });
});
