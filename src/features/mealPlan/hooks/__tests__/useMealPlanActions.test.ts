import { gql, type InMemoryCache } from '@apollo/client';
import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  ErrorCode,
  MealPlanType,
  TopLevelErrorCode,
} from '#/graphql/generated/schemaTypes';
import {
  holdMock,
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
  type MockedResponse,
  type MockFor,
} from '#/test-utils/apolloMockProvider';
import {
  CreateMealPlanDocument,
  UpdateMealPlanDocument,
  DeleteMealPlanDocument,
  GetMealPlanDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import type { CreateMealPlanInput } from '#/graphql/generated/schemaTypes';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { writeLocalMealPlan } from '#features/mealPlan/cache/mealPlan';
import { alertService } from '#/services/alertService';
import { t } from '#/i18n';
import { useMealPlan } from '../useMealPlan';
import { useMealPlanActions } from '../useMealPlanActions';

/** The actions beside the screen's own watcher of the plan, as on MealPlanMain. */
function usePlanAndActions() {
  useMealPlan('plan-1');
  return useMealPlanActions();
}

beforeEach(() => {
  jest.clearAllMocks();
});

/** A week's plan as the create form sends it. */
const weekPlan = (name: string): CreateMealPlanInput => ({
  name,
  planType: MealPlanType.Weekly,
  startDate: '2025-06-01',
  endDate: '2025-06-07',
});

const createAnswering = (
  createMealPlan: MockDataFor<typeof CreateMealPlanDocument>['createMealPlan'],
  { held = false }: { held?: boolean } = {},
) => recordMock(CreateMealPlanDocument, { data: { createMealPlan }, held });

const deleteAnswering = (
  deleteMealPlan: MockDataFor<typeof DeleteMealPlanDocument>['deleteMealPlan'],
) => recordMock(DeleteMealPlanDocument, { data: { deleteMealPlan } });

const renderActions = (
  mocks: MockedResponse[],
  cache: InMemoryCache = makeCache(),
) =>
  renderHookWithApollo(() => useMealPlanActions(), {
    operationMocks: mocks,
    cache,
  });

describe('useMealPlanActions', () => {
  it('returns loading states all false initially', () => {
    const { result } = renderHookWithApollo(() => useMealPlanActions());

    expect(result.current.creating).toBe(false);
    expect(result.current.deleting).toBe(false);
  });

  it('createMealPlan calls mutation and reports it applied', async () => {
    const create = createAnswering({ __typename: 'CreateMealPlanPayload' });
    const { result } = renderActions([create.mock]);

    let created:
      | Awaited<ReturnType<typeof result.current.createMealPlan>>
      | undefined;
    await act(async () => {
      created = await result.current.createMealPlan(weekPlan('Week Plan'));
    });

    expect(created).toEqual({ status: 'applied' });
    // Local-first: the hook mints a permanent cuid id into the input.
    expect(create.fired).toContainEqual({
      input: {
        ...weekPlan('Week Plan'),
        id: expect.stringMatching(/^(?:[a-z][0-9a-z]{23,31}|[0-9a-fA-F]{24})$/),
      },
    });
  });

  it('createMealPlan holds the minted id unconfirmed until the server answers', async () => {
    const create = createAnswering(
      { __typename: 'CreateMealPlanPayload' },
      { held: true },
    );
    const { result } = renderActions([create.mock]);

    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = result.current.createMealPlan(weekPlan('Camping'));
    });

    await waitFor(() => expect(create.fired).toHaveLength(1));
    const { id } = create.fired[0]?.input as { id: string };

    // In flight: the plan is in the cache and drives the active-plan selection,
    // but no server row exists for it yet.
    expect(unconfirmedCreates.has(id)).toBe(true);

    await act(async () => {
      create.release();
      await pending;
    });

    expect(unconfirmedCreates.has(id)).toBe(false);
  });

  it('createMealPlan reports a null payload as queued, with nothing shown', async () => {
    const { result } = renderActions([createAnswering(null).mock]);

    let created:
      | Awaited<ReturnType<typeof result.current.createMealPlan>>
      | undefined;
    await act(async () => {
      created = await result.current.createMealPlan(weekPlan('X'));
    });

    expect(created).toEqual({ status: 'queued' });
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('createMealPlan hands a refusal back unshown when the caller presents it', async () => {
    const refused = createAnswering({
      __typename: 'ValidationError',
      code: ErrorCode.ValidationFailed,
      field: 'input.name',
    });
    const { result } = renderActions([refused.mock]);

    let created:
      | Awaited<ReturnType<typeof result.current.createMealPlan>>
      | undefined;
    await act(async () => {
      created = await result.current.createMealPlan(weekPlan('X'), {
        present: 'none',
      });
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
    const update = recordMock(UpdateMealPlanDocument, {
      data: {
        updateMealPlan: {
          __typename: 'UpdateMealPlanPayload',
          mealPlan: { id: 'plan-1', name: 'Updated', version: 4 },
        },
      },
    });
    const { result } = renderActions([update.mock], cache);

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

  /**
   * A hand-built answer to `UpdateMealPlan`, recording what it was sent and
   * held until `release()`.
   */
  const updateAnswering = (
    result: MockFor<typeof UpdateMealPlanDocument>['result'],
  ) => {
    const fired: Array<Record<string, unknown>> = [];
    const { mock, release } = holdMock<MockFor<typeof UpdateMealPlanDocument>>({
      request: {
        query: UpdateMealPlanDocument,
        variables: vars => {
          fired.push(vars);
          return true;
        },
      },
      result,
    });
    return { fired, mock, release };
  };

  /** The plan as the server reads it back, holding no meals. */
  const planAsServed = (plan: {
    name: string;
    version: number;
  }): MockDataFor<typeof GetMealPlanDocument> => ({
    mealPlan: {
      __typename: 'MealPlan',
      id: 'plan-1',
      ...plan,
      mealPlanItemsConnection: {
        edges: [],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  });

  const staleVersionRefusals: Array<
    [string, MockFor<typeof UpdateMealPlanDocument>['result']]
  > = [
    [
      'the VERSION_CONFLICT member',
      {
        data: {
          updateMealPlan: {
            __typename: 'ConflictError',
            code: ErrorCode.VersionConflict,
            message: 'raw server English',
          },
        },
      },
    ],
    [
      'a top-level RESOURCE_VERSION_CONFLICT',
      {
        data: null,
        errors: [
          {
            message: 'raw server English',
            extensions: { code: TopLevelErrorCode.ResourceVersionConflict },
          },
        ],
      },
    ],
  ];

  // Another member renamed the plan since it was read: theirs is shown.
  it.each(staleVersionRefusals)(
    "updateMealPlan shows the other member's plan and says the rename was not saved when refused with %s",
    async (_label, refusal) => {
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
      const screenRead = recordMock(GetMealPlanDocument, {
        data: planAsServed({ name: 'Week Plan', version: 3 }),
        maxUsageCount: 1,
      });
      const reRead = recordMock(GetMealPlanDocument, {
        data: planAsServed({ name: 'Their Plan', version: 4 }),
      });
      const update = updateAnswering(refusal);

      const { result } = renderHookWithApollo(usePlanAndActions, {
        operationMocks: [screenRead.mock, reRead.mock, update.mock],
        cache,
      });
      await waitFor(() => expect(readPlan(cache)?.version).toBe(3));

      let pending: Promise<boolean> | undefined;
      act(() => {
        pending = result.current.updateMealPlan('plan-1', { name: 'Renamed' });
      });
      // Local-first: the rename shows before the server answers.
      await waitFor(() => expect(readPlan(cache)?.name).toBe('Renamed'));
      expect(update.fired).toHaveLength(1);

      let updated: boolean | undefined;
      await act(async () => {
        update.release();
        updated = await pending;
      });

      expect(updated).toBe(false);
      expect(update.fired).toEqual([
        { input: { id: 'plan-1', name: 'Renamed', version: 3 } },
      ]);
      await waitFor(() =>
        expect(readPlan(cache)).toMatchObject({
          name: 'Their Plan',
          version: 4,
        }),
      );
      expect(reRead.fired).toHaveLength(1);
      // Told, with nothing left to do: the plan on screen is already theirs.
      expect(alertService.alert).toHaveBeenCalledTimes(1);
      expect(alertService.alert).toHaveBeenCalledWith(
        t('errors.changedElsewhereTitle'),
        t('errors.changedElsewhereLatestShown'),
      );
    },
  );

  it('updateMealPlan puts the plan back without re-reading it on any other refusal', async () => {
    const cache = makeCache();
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
    const screenRead = recordMock(GetMealPlanDocument, {
      data: planAsServed({ name: 'Week Plan', version: 3 }),
    });
    const update = recordMock(UpdateMealPlanDocument, {
      data: {
        updateMealPlan: {
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
          message: 'raw server English',
        },
      },
    });

    const { result } = renderHookWithApollo(usePlanAndActions, {
      operationMocks: [screenRead.mock, update.mock],
      cache,
    });
    await waitFor(() => expect(readPlan(cache)?.version).toBe(3));

    let updated: boolean | undefined;
    await act(async () => {
      updated = await result.current.updateMealPlan('plan-1', {
        name: 'Renamed',
      });
    });

    expect(updated).toBe(false);
    expect(readPlan(cache)).toMatchObject({ name: 'Week Plan', version: 3 });
    expect(screenRead.fired).toHaveLength(1);
    expect(alertService.alert).toHaveBeenCalledTimes(1);
  });

  it('deleteMealPlan returns true on success', async () => {
    const del = deleteAnswering({
      __typename: 'DeleteMealPlanPayload',
      mealPlan: { id: 'plan-1' },
    });
    const { result } = renderActions([del.mock]);

    let deleted: boolean | undefined;
    await act(async () => {
      deleted = await result.current.deleteMealPlan('plan-1');
    });

    expect(deleted).toBe(true);
    expect(del.fired).toContainEqual({ input: { id: 'plan-1' } });
  });

  it.each<
    [
      string,
      MockDataFor<typeof DeleteMealPlanDocument>['deleteMealPlan'],
      boolean,
      number,
    ]
  >([
    [
      'deleteMealPlan counts a plan that is already gone as deleted',
      { __typename: 'NotFoundError', code: ErrorCode.NotFound },
      true,
      0,
    ],
    [
      'deleteMealPlan returns false and reports once on a refusal',
      { __typename: 'ForbiddenError', code: ErrorCode.Forbidden },
      false,
      1,
    ],
  ])('%s', async (_name, answer, removed, alerts) => {
    const { result } = renderActions([deleteAnswering(answer).mock]);

    let deleted: boolean | undefined;
    await act(async () => {
      deleted = await result.current.deleteMealPlan('plan-1');
    });

    expect(deleted).toBe(removed);
    expect(alertService.alert).toHaveBeenCalledTimes(alerts);
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
    const del = deleteAnswering({
      __typename: 'DeleteMealPlanPayload',
      mealPlan: { id: 'plan-1' },
    });
    const { result } = renderActions([del.mock], cache);

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
