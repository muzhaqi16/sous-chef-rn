import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import type { MockDataFor } from '#/test-utils/apolloMockProvider';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  CreateMealPlanItemDocument,
  UpdateMealPlanItemDocument,
  DeleteMealPlanItemDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import {
  ErrorCode,
  MealType,
  type CreateMealPlanItemInput,
} from '#/graphql/generated/schemaTypes';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { getVersionConflictMessage } from '#/utils/errors/versionConflict';
import { useMealPlanItemActions } from '../useMealPlanItemActions';
import {
  MealPlanItemActions_OptimisticFullItemFragmentDoc,
  MealPlanItemActions_PlanBoundsFragmentDoc,
} from '../useMealPlanItemActions.generated';

const seedToggleItem = (overrides: Record<string, unknown> = {}) =>
  seedCache([
    {
      // The compound selection `toggleCompleted` reads back, so a fixture too
      // thin for it fails here rather than reverting the optimistic write.
      fragment: MealPlanItemActions_OptimisticFullItemFragmentDoc,
      fragmentName: 'MealPlanItemActions_optimisticFullItem',
      data: {
        __typename: 'MealPlanItem',
        id: 'mpi-1',
        isCompleted: false,
        completedAt: null,
        servings: 1,
        notes: null,
        customMealName: null,
        calories: null,
        usedPantryItems: [],
        mealType: 'DINNER',
        date: '2025-06-15',
        recipe: {
          __typename: 'Recipe',
          id: 'r-1',
          name: 'Pasta',
          servings: 1,
          imageUrl: null,
          totalTimeMinutes: 0,
        },
        ...overrides,
      },
    },
  ]);

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: {
    success: (...args: [message: string, opts?: Record<string, unknown>]) =>
      mockToastSuccess(...args),
    error: (...args: [message: string, opts?: Record<string, unknown>]) =>
      mockToastError(...args),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToParentArrayUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentArrayUpdater: jest.fn(() => jest.fn()),
}));

jest.mock('#/apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useMealPlanItemActions', () => {
  it('reports no create in flight initially', () => {
    const { result } = renderHookWithApollo(() =>
      useMealPlanItemActions('plan-1'),
    );

    expect(result.current.creating).toBe(false);
  });

  describe('createItem', () => {
    it('returns true on success', async () => {
      const data: MockDataFor<typeof CreateMealPlanItemDocument> = {
        createMealPlanItem: {
          __typename: 'CreateMealPlanItemPayload',
          mealPlanItem: { __typename: 'MealPlanItem', id: 'mpi-1' },
        },
      };
      const create = recordMock(CreateMealPlanItemDocument, {
        data,
      });

      const { result } = renderHookWithApollo(
        () => useMealPlanItemActions('plan-1'),
        { operationMocks: [create.mock] },
      );

      let created!: Awaited<ReturnType<typeof result.current.createItem>>;
      await act(async () => {
        created = await result.current.createItem({
          mealPlanId: 'plan-1',
          meal: { recipeId: 'r-1' },
          mealType: MealType.Dinner,
          date: '2025-06-15',
        } satisfies CreateMealPlanItemInput);
      });

      expect(created).toBe(true);
    });

    // A plan stored before boundaries were sent at noon ends at local midnight
    // of its last day, a UTC day the noon meal would fall after.
    it('sends a last-day meal at the plan end the server holds, on the picked day', async () => {
      const planEnd = new Date(2026, 8, 27, 0, 0).toISOString();
      const pickedDay = new Date(2026, 8, 27, 12).toISOString();
      const cache = seedCache([
        {
          fragment: MealPlanItemActions_PlanBoundsFragmentDoc,
          fragmentName: 'MealPlanItemActions_planBounds',
          data: {
            __typename: 'MealPlan',
            id: 'plan-1',
            startDate: new Date(2026, 8, 21, 0, 0).toISOString(),
            endDate: planEnd,
          },
        },
      ]);
      const create = recordMock(CreateMealPlanItemDocument, {
        data: {
          createMealPlanItem: {
            __typename: 'CreateMealPlanItemPayload',
            mealPlanItem: { __typename: 'MealPlanItem', id: 'mpi-1' },
          },
        },
      });
      const { result } = renderHookWithApollo(
        () => useMealPlanItemActions('plan-1'),
        { operationMocks: [create.mock], cache },
      );

      await act(async () => {
        await result.current.createItem({
          mealPlanId: 'plan-1',
          meal: { recipeId: 'r-1' },
          mealType: MealType.Dinner,
          date: pickedDay,
        });
      });

      const [sent] = create.fired;
      const sentDate = (sent?.input as { date: string } | undefined)?.date;
      expect(sentDate).toBe(planEnd);
      expect(new Date(sentDate ?? '').getDate()).toBe(27);
    });

    it('shows one localized error toast and returns false on failure', async () => {
      const data: MockDataFor<typeof CreateMealPlanItemDocument> = {
        createMealPlanItem: {
          __typename: 'ConflictError',
          code: ErrorCode.Conflict,
          message: 'Conflict',
        },
      };
      const create = recordMock(CreateMealPlanItemDocument, {
        data,
      });

      // Inline fragments on the Error interface require possibleTypes for the
      // cache to keep `code`/`message` when the concrete return is a
      // ConflictError. The default test cache omits possibleTypes.
      const cache = makeCache();
      const { result } = renderHookWithApollo(
        () => useMealPlanItemActions('plan-1'),
        { operationMocks: [create.mock], cache },
      );

      let created!: Awaited<ReturnType<typeof result.current.createItem>>;
      await act(async () => {
        created = await result.current.createItem({
          mealPlanId: 'plan-1',
          meal: { recipeId: 'r-1' },
          mealType: MealType.Dinner,
          date: '2025-06-15',
        } satisfies CreateMealPlanItemInput);
      });

      expect(created).toBe(false);
      // The app's copy for the code, never the server's `message`.
      expect(mockToastError).toHaveBeenCalledTimes(1);
      // `CONFLICT` is a state refusal, never "updated by another user".
      expect(mockToastError).not.toHaveBeenCalledWith(
        getVersionConflictMessage(),
      );
      expect(mockToastError).not.toHaveBeenCalledWith('Conflict');
    });
  });

  describe('toggleCompleted', () => {
    it('marks item as completed and shows toast', async () => {
      const data: MockDataFor<typeof UpdateMealPlanItemDocument> = {
        updateMealPlanItem: {
          __typename: 'UpdateMealPlanItemPayload',
          mealPlanItem: {
            __typename: 'MealPlanItem',
            id: 'mpi-1',
            isCompleted: true,
          },
        },
      };
      const update = recordMock(UpdateMealPlanItemDocument, {
        data,
      });

      const cache = seedToggleItem();
      const { result } = renderHookWithApollo(
        () => useMealPlanItemActions('plan-1'),
        { operationMocks: [update.mock], cache },
      );

      await act(async () => {
        await result.current.toggleCompleted('mpi-1');
      });

      expect(update.fired).toContainEqual(
        expect.objectContaining({
          input: expect.objectContaining({
            id: 'mpi-1',
            isCompleted: true,
          }),
        }),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith('Meal completed!');
    });

    it('shows deduction toast when deductFromPantry is true', async () => {
      const data: MockDataFor<typeof UpdateMealPlanItemDocument> = {
        updateMealPlanItem: {
          __typename: 'UpdateMealPlanItemPayload',
          mealPlanItem: {
            __typename: 'MealPlanItem',
            id: 'mpi-1',
            isCompleted: true,
          },
        },
      };
      const update = recordMock(UpdateMealPlanItemDocument, {
        data,
      });

      const cache = seedToggleItem();
      const { result } = renderHookWithApollo(
        () => useMealPlanItemActions('plan-1'),
        { operationMocks: [update.mock], cache },
      );

      await act(async () => {
        await result.current.toggleCompleted('mpi-1', {
          deductFromPantry: true,
        });
      });

      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Meal completed! Pantry items deducted.',
      );
    });

    it('does not show toast when un-completing', async () => {
      const data: MockDataFor<typeof UpdateMealPlanItemDocument> = {
        updateMealPlanItem: {
          __typename: 'UpdateMealPlanItemPayload',
          mealPlanItem: {
            __typename: 'MealPlanItem',
            id: 'mpi-1',
            isCompleted: false,
          },
        },
      };
      const update = recordMock(UpdateMealPlanItemDocument, {
        data,
      });

      const cache = seedToggleItem({ isCompleted: true });
      const { result } = renderHookWithApollo(
        () => useMealPlanItemActions('plan-1'),
        { operationMocks: [update.mock], cache },
      );

      await act(async () => {
        await result.current.toggleCompleted('mpi-1');
      });

      expect(mockToastSuccess).not.toHaveBeenCalled();
    });
  });

  describe('deleteItem', () => {
    it('claims the row against subscription echoes while the delete is in flight', async () => {
      // The subscription handler's isPendingDelete guard is only reachable
      // because this registers; without it a stale ITEM_ADDED for the same id
      // re-adds the meal after the optimistic removal.
      const data: MockDataFor<typeof DeleteMealPlanItemDocument> = {
        deleteMealPlanItem: {
          __typename: 'DeleteMealPlanItemPayload',
          mealPlanItem: { __typename: 'MealPlanItem', id: 'mpi-1' },
        },
      };
      const del = recordMock(DeleteMealPlanItemDocument, {
        data,
        delay: 20,
      });

      const { result } = renderHookWithApollo(
        () => useMealPlanItemActions('plan-1'),
        { operationMocks: [del.mock] },
      );

      let pending: Promise<unknown> | undefined;
      act(() => {
        pending = result.current.deleteItem('mpi-1');
      });

      await waitFor(() =>
        expect(subscriptionService.isPendingDelete('mpi-1')).toBe(true),
      );

      await act(async () => {
        await pending;
      });

      // Released once the server has answered — the row is gone for good.
      expect(subscriptionService.isPendingDelete('mpi-1')).toBe(false);
    });

    it('returns true on success', async () => {
      const data: MockDataFor<typeof DeleteMealPlanItemDocument> = {
        deleteMealPlanItem: {
          __typename: 'DeleteMealPlanItemPayload',
          mealPlanItem: { __typename: 'MealPlanItem', id: 'mpi-1' },
        },
      };
      const del = recordMock(DeleteMealPlanItemDocument, {
        data,
      });

      const { result } = renderHookWithApollo(
        () => useMealPlanItemActions('plan-1'),
        { operationMocks: [del.mock] },
      );

      let deleted: boolean | undefined;
      await act(async () => {
        deleted = await result.current.deleteItem('mpi-1');
      });

      expect(deleted).toBe(true);
    });

    it('counts a meal that is already gone as deleted', async () => {
      const data: MockDataFor<typeof DeleteMealPlanItemDocument> = {
        deleteMealPlanItem: {
          __typename: 'NotFoundError',
          code: ErrorCode.NotFound,
          message: 'Meal plan item not found',
        },
      };
      const del = recordMock(DeleteMealPlanItemDocument, {
        data,
      });

      const { result } = renderHookWithApollo(
        () => useMealPlanItemActions('plan-1'),
        { operationMocks: [del.mock] },
      );

      let deleted: boolean | undefined;
      await act(async () => {
        deleted = await result.current.deleteItem('mpi-1');
      });

      expect(deleted).toBe(true);
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('returns false on failure', async () => {
      const data: MockDataFor<typeof DeleteMealPlanItemDocument> = {
        deleteMealPlanItem: {
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
          message: 'raw server English',
        },
      };
      const del = recordMock(DeleteMealPlanItemDocument, {
        data,
      });

      const { result } = renderHookWithApollo(
        () => useMealPlanItemActions('plan-1'),
        { operationMocks: [del.mock] },
      );

      let deleted: boolean | undefined;
      await act(async () => {
        deleted = await result.current.deleteItem('mpi-1');
      });

      expect(deleted).toBe(false);
    });
  });
});
