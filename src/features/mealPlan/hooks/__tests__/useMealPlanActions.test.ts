import { gql } from '@apollo/client';
import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { ErrorCode, MealPlanType } from '#/graphql/generated/schemaTypes';
import type { MockDataFor } from '#/test-utils/apolloMockProvider';
import {
  inputOf,
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
import { writeLocalMealPlan } from '#features/mealPlan/cache/mealPlan';
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

  const PLAN_VERSION = gql`
    fragment SeedPlanNameAtVersion on MealPlan {
      id
      name
      version
    }
  `;

  const planAtVersion = (version: number) => {
    const cache = makeCache();
    cache.writeFragment({
      fragment: PLAN_VERSION,
      data: {
        __typename: 'MealPlan',
        id: 'plan-1',
        name: 'Week Plan',
        version,
      },
    });
    return cache;
  };

  const readPlan = (cache: ReturnType<typeof makeCache>) =>
    cache.readFragment<{ name: string; version: number }>({
      id: 'MealPlan:plan-1',
      fragment: PLAN_VERSION,
    });

  it('updateMealPlan states the id and the version the cache holds, and its answer lands in the cache', async () => {
    const cache = planAtVersion(3);
    const data: MockDataFor<typeof UpdateMealPlanDocument> = {
      updateMealPlan: {
        __typename: 'UpdateMealPlanPayload',
        mealPlan: {
          __typename: 'MealPlan',
          id: 'plan-1',
          name: 'Updated',
          version: 4,
        },
      },
    };
    const update = recordMock(UpdateMealPlanDocument, {
      data,
    });

    const { result } = renderHookWithApollo(() => useMealPlanActions(), {
      operationMocks: [update.mock],
      cache,
    });

    let updated: boolean | undefined;
    await act(async () => {
      updated = await result.current.updateMealPlan('plan-1', {
        name: 'Updated',
      });
    });

    expect(updated).toBe(true);
    // The caller states neither: the id is the argument, the version the cache's.
    expect(update.fired).toEqual([
      { input: { id: 'plan-1', name: 'Updated', version: 3 } },
    ]);
    expect(readPlan(cache)).toMatchObject({ name: 'Updated', version: 4 });
  });

  // The API refuses an edit that states no version, so one is never sent.
  it('updateMealPlan sends nothing and reports a failure for a plan whose version the cache does not hold', async () => {
    const update = recordMock(UpdateMealPlanDocument, {
      error: new Error('should not be sent without a version'),
    });

    const { result } = renderHookWithApollo(() => useMealPlanActions(), {
      operationMocks: [update.mock],
      cache: makeCache(),
    });

    let updated: boolean | undefined;
    await act(async () => {
      updated = await result.current.updateMealPlan('plan-1', {
        name: 'Updated',
      });
    });

    expect(updated).toBe(false);
    expect(update.fired).toHaveLength(0);
    expect(alertService.alert).toHaveBeenCalledTimes(1);
  });

  it('updateMealPlan puts the plan back and offers a refresh when it was changed elsewhere', async () => {
    const cache = makeCache();
    // The complete list-card row: what the local write and its revert read.
    writeLocalMealPlan(
      cache,
      'plan-1',
      {
        name: 'Week Plan',
        planType: MealPlanType.Weekly,
        startDate: '2025-06-01',
        endDate: '2025-06-07',
      },
      'user-1',
    );
    const data: MockDataFor<typeof UpdateMealPlanDocument> = {
      updateMealPlan: {
        __typename: 'ConflictError',
        code: ErrorCode.VersionConflict,
        message: 'raw server English',
      },
    };
    const update = recordMock(UpdateMealPlanDocument, {
      data,
      delay: 20,
    });

    const { result } = renderHookWithApollo(() => useMealPlanActions(), {
      operationMocks: [update.mock],
      cache,
    });

    let pending: Promise<boolean> | undefined;
    act(() => {
      pending = result.current.updateMealPlan('plan-1', { name: 'Renamed' });
    });
    // Local-first: the rename shows before the server answers.
    await waitFor(() => expect(readPlan(cache)?.name).toBe('Renamed'));

    let updated: boolean | undefined;
    await act(async () => {
      updated = await pending;
    });

    expect(updated).toBe(false);
    // A local plan is written at version 1, which is what the edit stated.
    expect(update.fired).toEqual([
      { input: { id: 'plan-1', name: 'Renamed', version: 1 } },
    ]);
    expect(readPlan(cache)).toMatchObject({ name: 'Week Plan', version: 1 });
    expect(alertService.alert).toHaveBeenCalledTimes(1);
    expect(alertService.alert).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ onPress: expect.any(Function) }),
      ]),
    );
  });

  // Online writes are not queued, so nothing rebased the second onto the
  // version the first moved the row to: it was refused as changed elsewhere.
  it('updateMealPlan sends a second update inside one round trip at the version the first answer wrote', async () => {
    const cache = makeCache();
    cache.writeFragment({
      fragment: gql`
        fragment SeedPlanVersion on MealPlan {
          id
          version
        }
      `,
      data: { __typename: 'MealPlan', id: 'plan-1', version: 3 },
    });
    const update = recordMock(UpdateMealPlanDocument, {
      dataFor: (vars): MockDataFor<typeof UpdateMealPlanDocument> => ({
        updateMealPlan: {
          __typename: 'UpdateMealPlanPayload',
          mealPlan: {
            __typename: 'MealPlan',
            id: 'plan-1',
            version: Number(inputOf(vars).version) + 1,
          },
        },
      }),
      delay: 20,
    });
    const { result } = renderHookWithApollo(() => useMealPlanActions(), {
      operationMocks: [update.mock],
      cache,
    });

    let updated: boolean[] = [];
    await act(async () => {
      updated = await Promise.all([
        result.current.updateMealPlan('plan-1', { dietaryProfileId: 'p-1' }),
        result.current.updateMealPlan('plan-1', { dietaryProfileId: null }),
      ]);
    });

    expect(updated).toEqual([true, true]);
    expect(update.fired.map(({ input }) => input)).toEqual([
      expect.objectContaining({ version: 3, dietaryProfileId: 'p-1' }),
      expect.objectContaining({ version: 4, dietaryProfileId: null }),
    ]);
    expect(alertService.alert).not.toHaveBeenCalled();
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

  // The response's `mealPlan { id }` re-creates the evicted plan; a list edge
  // left pointing at it would read a plan with no fields and blank the list.
  it('deleteMealPlan leaves the list readable without the plan once the response lands', async () => {
    const PLANS = gql`
      query TestDeletePlansList {
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
    const cache = makeCache();
    cache.writeQuery({
      query: PLANS,
      data: {
        mealPlans: {
          __typename: 'MealPlanConnection',
          totalCount: 2,
          edges: ['plan-1', 'plan-2'].map(id => ({
            __typename: 'MealPlanEdge',
            node: { __typename: 'MealPlan', id, name: id },
          })),
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
      operationMocks: [del.mock],
      cache,
    });

    await act(async () => {
      await result.current.deleteMealPlan('plan-1');
    });

    const list = cache.readQuery<{
      mealPlans: { edges: Array<{ node: { id: string } }> };
    }>({ query: PLANS });
    expect(list?.mealPlans.edges.map(({ node }) => node.id)).toEqual([
      'plan-2',
    ]);
    expect(cache.extract()['MealPlan:plan-1']).toBeUndefined();
  });
});
