import { act, waitFor } from '@testing-library/react-native';
import { InMemoryCache } from '@apollo/client';
import fragmentMatcherData from '#/graphql/generated/fragmentMatcher.json';
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
  MealType,
  type CreateMealPlanItemInput,
  type UpdateMealPlanItemInput,
} from '#/graphql/generated/schemaTypes';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { useStore } from '#store';
import { useMealPlanItemActions } from '../useMealPlanItemActions';

const seedToggleItem = (overrides: Record<string, unknown> = {}) =>
  seedCache([
    {
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

afterEach(() => {
  useStore.setState({ apiReachable: true, isOnline: true });
});

describe('useMealPlanItemActions', () => {
  it('returns loading states all false initially', () => {
    const { result } = renderHookWithApollo(() =>
      useMealPlanItemActions('plan-1'),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.creating).toBe(false);
    expect(result.current.updating).toBe(false);
    expect(result.current.deleting).toBe(false);
    expect(result.current.isApiUnavailable).toBe(false);
  });

  describe('when the API is unavailable', () => {
    // These actions are online-only: they refuse up front instead of writing
    // the cache ahead of the server and replaying later.
    it('exposes isApiUnavailable and refuses every action without firing', async () => {
      useStore.setState({ apiReachable: false });

      const create = recordMock(CreateMealPlanItemDocument, {
        data: {
          createMealPlanItem: {
            __typename: 'CreateMealPlanItemPayload',
            mealPlanItem: { __typename: 'MealPlanItem', id: 'mpi-1' },
          },
        },
      });
      const update = recordMock(UpdateMealPlanItemDocument, {
        data: {
          updateMealPlanItem: {
            __typename: 'UpdateMealPlanItemPayload',
            mealPlanItem: { __typename: 'MealPlanItem', id: 'mpi-1' },
          },
        },
      });
      const del = recordMock(DeleteMealPlanItemDocument, {
        data: {
          deleteMealPlanItem: {
            __typename: 'DeleteMealPlanItemPayload',
            mealPlanItem: { __typename: 'MealPlanItem', id: 'mpi-1' },
          },
        },
      });

      const cache = seedToggleItem();
      const { result } = renderHookWithApollo(
        () => useMealPlanItemActions('plan-1'),
        { operationMocks: [create.mock, update.mock, del.mock], cache },
      );

      expect(result.current.isApiUnavailable).toBe(true);

      let created: unknown;
      let updated: unknown;
      let toggled: unknown;
      let deleted: unknown;
      await act(async () => {
        created = await result.current.createItem({
          mealPlanId: 'plan-1',
          meal: { recipeId: 'r-1' },
          mealType: MealType.Dinner,
          date: '2025-06-15',
        } satisfies CreateMealPlanItemInput);
        updated = await result.current.updateItem('mpi-1', { servings: 3 });
        toggled = await result.current.toggleCompleted('mpi-1');
        deleted = await result.current.deleteItem('mpi-1');
      });

      expect(created).toBeNull();
      expect(updated).toBeNull();
      expect(toggled).toBeNull();
      expect(deleted).toBe(false);

      expect(create.fired).toHaveLength(0);
      expect(update.fired).toHaveLength(0);
      expect(del.fired).toHaveLength(0);
      expect(mockToastError).toHaveBeenCalledTimes(4);
      expect(mockToastError).toHaveBeenCalledWith('Not available offline');
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });

    it('leaves the row untouched in the cache', async () => {
      useStore.setState({ apiReachable: false });

      const cache = seedToggleItem();
      const { result } = renderHookWithApollo(
        () => useMealPlanItemActions('plan-1'),
        { cache },
      );

      await act(async () => {
        await result.current.toggleCompleted('mpi-1');
        await result.current.deleteItem('mpi-1');
      });

      expect(
        cache.extract()['MealPlanItem:mpi-1'] as { isCompleted: boolean },
      ).toEqual(expect.objectContaining({ isCompleted: false }));
    });
  });

  describe('createItem', () => {
    it('returns payload on success', async () => {
      const payload = {
        __typename: 'CreateMealPlanItemPayload',
        mealPlanItem: { __typename: 'MealPlanItem', id: 'mpi-1' },
      };
      const create = recordMock(CreateMealPlanItemDocument, {
        data: { createMealPlanItem: payload },
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

      expect(created).toEqual(payload);
    });

    it('shows error toast and returns null on failure', async () => {
      const create = recordMock(CreateMealPlanItemDocument, {
        data: {
          createMealPlanItem: {
            __typename: 'ConflictError',
            code: 'CONFLICT',
            message: 'Conflict',
          },
        },
      });

      // Inline fragments on the Error interface require possibleTypes for the
      // cache to keep `code`/`message` when the concrete return is a
      // ConflictError. The default test cache omits possibleTypes.
      const cache = new InMemoryCache({
        possibleTypes: fragmentMatcherData.possibleTypes,
      });
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

      expect(created).toBeNull();
      // The server's `message` ('Conflict') is unlocalizable English and is
      // never what the person reads.
      expect(mockToastError).toHaveBeenCalledWith('Failed to add item');
    });
  });

  describe('updateItem', () => {
    it('returns payload on success', async () => {
      const payload = {
        __typename: 'UpdateMealPlanItemPayload',
        mealPlanItem: { __typename: 'MealPlanItem', id: 'mpi-1' },
      };
      const update = recordMock(UpdateMealPlanItemDocument, {
        data: { updateMealPlanItem: payload },
      });

      const { result } = renderHookWithApollo(
        () => useMealPlanItemActions('plan-1'),
        { operationMocks: [update.mock] },
      );

      let updated!: Awaited<ReturnType<typeof result.current.updateItem>>;
      await act(async () => {
        updated = await result.current.updateItem('mpi-1', {
          servings: 3,
        } satisfies Omit<UpdateMealPlanItemInput, 'id'>);
      });

      expect(updated).toEqual(payload);
    });
  });

  describe('toggleCompleted', () => {
    it('marks item as completed and shows toast', async () => {
      const update = recordMock(UpdateMealPlanItemDocument, {
        data: {
          updateMealPlanItem: {
            __typename: 'UpdateMealPlanItemPayload',
            mealPlanItem: {
              __typename: 'MealPlanItem',
              id: 'mpi-1',
              isCompleted: true,
            },
          },
        },
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
      const update = recordMock(UpdateMealPlanItemDocument, {
        data: {
          updateMealPlanItem: {
            __typename: 'UpdateMealPlanItemPayload',
            mealPlanItem: {
              __typename: 'MealPlanItem',
              id: 'mpi-1',
              isCompleted: true,
            },
          },
        },
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
      const update = recordMock(UpdateMealPlanItemDocument, {
        data: {
          updateMealPlanItem: {
            __typename: 'UpdateMealPlanItemPayload',
            mealPlanItem: {
              __typename: 'MealPlanItem',
              id: 'mpi-1',
              isCompleted: false,
            },
          },
        },
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
      const del = recordMock(DeleteMealPlanItemDocument, {
        data: {
          deleteMealPlanItem: {
            __typename: 'DeleteMealPlanItemPayload',
            mealPlanItem: { __typename: 'MealPlanItem', id: 'mpi-1' },
          },
        },
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
      const del = recordMock(DeleteMealPlanItemDocument, {
        data: {
          deleteMealPlanItem: {
            __typename: 'DeleteMealPlanItemPayload',
            mealPlanItem: { __typename: 'MealPlanItem', id: 'mpi-1' },
          },
        },
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

    it('returns false on failure', async () => {
      const del = recordMock(DeleteMealPlanItemDocument, {
        data: {
          deleteMealPlanItem: {
            __typename: 'NotFoundError',
            code: 'NOT_FOUND',
            message: 'Meal plan item not found',
          },
        },
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
