import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  CreateMealPlanDocument,
  UpdateMealPlanDocument,
  DeleteMealPlanDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import type { CreateMealPlanInput } from '#/graphql/generated/schemaTypes';
import { useMealPlanActions } from '../useMealPlanActions';

jest.mock('#/apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
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
        id: expect.stringMatching(/^c[a-z0-9]{24}$/),
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
});
