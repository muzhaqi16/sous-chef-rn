import { act, waitFor } from '@testing-library/react-native';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import type { MockDataFor } from '#/test-utils/apolloMockProvider';
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
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { alertService } from '#/services/alertService';
import { useMealPlanActions } from '../useMealPlanActions';

jest.mock('#/apollo/links/tokenScheduler');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useMealPlanActions', () => {
  it('returns loading states all false initially', () => {
    const { result } = renderHookWithApollo(() => useMealPlanActions());

    expect(result.current.creating).toBe(false);
    expect(result.current.deleting).toBe(false);
  });

  it('createMealPlan calls mutation and reports it applied', async () => {
    const data: MockDataFor<typeof CreateMealPlanDocument> = {
      createMealPlan: {
        __typename: 'CreateMealPlanPayload',
        mealPlan: {
          __typename: 'MealPlan',
          id: 'plan-1',
          name: 'Week Plan',
        },
      },
    };
    const create = recordMock(CreateMealPlanDocument, {
      data,
    });

    const { result } = renderHookWithApollo(() => useMealPlanActions(), {
      operationMocks: [create.mock],
    });

    let created:
      | Awaited<ReturnType<typeof result.current.createMealPlan>>
      | undefined;
    await act(async () => {
      created = await result.current.createMealPlan({
        name: 'Week Plan',
        startDate: '2025-06-01',
        endDate: '2025-06-07',
      } as CreateMealPlanInput);
    });

    expect(created).toEqual({ status: 'applied' });
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

  it('createMealPlan holds the minted id unconfirmed until the server answers', async () => {
    const data: MockDataFor<typeof CreateMealPlanDocument> = {
      createMealPlan: {
        __typename: 'CreateMealPlanPayload',
        mealPlan: {
          __typename: 'MealPlan',
          id: 'plan-1',
          name: 'Camping',
        },
      },
    };
    const create = recordMock(CreateMealPlanDocument, {
      data,
      // Must comfortably exceed testing-library's waitFor poll interval (50ms).
      // At the previous 20ms the mutation had usually already resolved by the
      // first poll, so `unconfirmedCreates` was cleared before the in-flight
      // assertion below ran — the test passed only when a poll happened to
      // land inside that 20ms window, which is why it failed intermittently
      // under full-suite load and passed in isolation.
      delay: 1000,
    });

    const { result } = renderHookWithApollo(() => useMealPlanActions(), {
      operationMocks: [create.mock],
    });

    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = result.current.createMealPlan({
        name: 'Camping',
        startDate: '2025-06-01',
        endDate: '2025-06-07',
      } as CreateMealPlanInput);
    });

    await waitFor(() => expect(create.fired).toHaveLength(1));
    const { id } = create.fired[0]?.input as { id: string };

    // In flight: the plan is in the cache and drives the active-plan selection,
    // but no server row exists for it yet.
    expect(unconfirmedCreates.has(id)).toBe(true);

    await act(async () => {
      await pending;
    });

    expect(unconfirmedCreates.has(id)).toBe(false);
  });

  it('createMealPlan reports a null payload as queued, with nothing shown', async () => {
    const data: MockDataFor<typeof CreateMealPlanDocument> = {
      createMealPlan: null,
    };
    const create = recordMock(CreateMealPlanDocument, {
      data,
    });

    const { result } = renderHookWithApollo(() => useMealPlanActions(), {
      operationMocks: [create.mock],
    });

    let created:
      | Awaited<ReturnType<typeof result.current.createMealPlan>>
      | undefined;
    await act(async () => {
      created = await result.current.createMealPlan({
        name: 'X',
        startDate: '2025-06-01',
        endDate: '2025-06-07',
      } as CreateMealPlanInput);
    });

    expect(created).toEqual({ status: 'queued' });
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('createMealPlan hands a refusal back unshown when the caller presents it', async () => {
    const data: MockDataFor<typeof CreateMealPlanDocument> = {
      createMealPlan: {
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        message: 'raw server English',
        field: 'input.name',
      },
    };
    const create = recordMock(CreateMealPlanDocument, {
      data,
    });

    const { result } = renderHookWithApollo(() => useMealPlanActions(), {
      operationMocks: [create.mock],
    });

    let created:
      | Awaited<ReturnType<typeof result.current.createMealPlan>>
      | undefined;
    await act(async () => {
      created = await result.current.createMealPlan(
        {
          name: 'X',
          startDate: '2025-06-01',
          endDate: '2025-06-07',
        } as CreateMealPlanInput,
        { present: 'none' },
      );
    });

    expect(created).toEqual({
      status: 'failed',
      failure: expect.objectContaining({ code: ErrorCode.ValidationFailed }),
    });
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('updateMealPlan calls mutation with id and input', async () => {
    const data: MockDataFor<typeof UpdateMealPlanDocument> = {
      updateMealPlan: {
        __typename: 'UpdateMealPlanPayload',
        mealPlan: {
          __typename: 'MealPlan',
          id: 'plan-1',
          name: 'Updated',
        },
      },
    };
    const update = recordMock(UpdateMealPlanDocument, {
      data,
    });

    const { result } = renderHookWithApollo(() => useMealPlanActions(), {
      operationMocks: [update.mock],
    });

    let updated: boolean | undefined;
    await act(async () => {
      updated = await result.current.updateMealPlan('plan-1', {
        name: 'Updated',
      });
    });

    expect(updated).toBe(true);
    expect(update.fired).toContainEqual({
      input: { id: 'plan-1', name: 'Updated' },
    });
  });

  it('deleteMealPlan returns true on success', async () => {
    const data: MockDataFor<typeof DeleteMealPlanDocument> = {
      deleteMealPlan: {
        __typename: 'DeleteMealPlanPayload',
        mealPlan: { __typename: 'MealPlan', id: 'plan-1' },
      },
    };
    const del = recordMock(DeleteMealPlanDocument, {
      data,
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

  it('deleteMealPlan counts a plan that is already gone as deleted', async () => {
    const data: MockDataFor<typeof DeleteMealPlanDocument> = {
      deleteMealPlan: {
        __typename: 'NotFoundError',
        code: ErrorCode.NotFound,
        message: 'Meal plan not found',
      },
    };
    const del = recordMock(DeleteMealPlanDocument, {
      data,
    });

    const { result } = renderHookWithApollo(() => useMealPlanActions(), {
      operationMocks: [del.mock],
    });

    let deleted: boolean | undefined;
    await act(async () => {
      deleted = await result.current.deleteMealPlan('plan-1');
    });

    expect(deleted).toBe(true);
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('deleteMealPlan returns false and reports once on a refusal', async () => {
    const data: MockDataFor<typeof DeleteMealPlanDocument> = {
      deleteMealPlan: {
        __typename: 'ForbiddenError',
        code: ErrorCode.Forbidden,
        message: 'raw server English',
      },
    };
    const del = recordMock(DeleteMealPlanDocument, {
      data,
    });

    const { result } = renderHookWithApollo(() => useMealPlanActions(), {
      operationMocks: [del.mock],
    });

    let deleted: boolean | undefined;
    await act(async () => {
      deleted = await result.current.deleteMealPlan('plan-1');
    });

    expect(deleted).toBe(false);
    expect(alertService.alert).toHaveBeenCalledTimes(1);
  });
});
