import { act } from '@testing-library/react-native';
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
      usedPantryItems: null,
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
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
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
  it('returns loading states all false initially', () => {
    const { result } = renderHookWithApollo(() =>
      useMealPlanItemActions('plan-1'),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.creating).toBe(false);
    expect(result.current.updating).toBe(false);
    expect(result.current.deleting).toBe(false);
  });

  describe('createItem', () => {
    it('returns payload on success', async () => {
      const payload = {
        __typename: 'MealPlanItemPayload',
        success: true,
        message: 'Created',
        mealPlanItem: { __typename: 'MealPlanItem', id: 'mpi-1' },
      };
      const create = recordMock(CreateMealPlanItemDocument, {
        data: { createMealPlanItem: payload },
      });

      const { result } = renderHookWithApollo(
        () => useMealPlanItemActions('plan-1'),
        { operationMocks: [create.mock] },
      );

      let created: any;
      await act(async () => {
        created = await result.current.createItem({
          mealPlanId: 'plan-1',
          recipeId: 'r-1',
          mealType: 'DINNER',
          date: '2025-06-15',
        } as any);
      });

      expect(created).toEqual(payload);
    });

    it('shows error toast and returns null on failure', async () => {
      const create = recordMock(CreateMealPlanItemDocument, {
        data: {
          createMealPlanItem: {
            __typename: 'MealPlanItemPayload',
            success: false,
            message: 'Conflict',
          },
        },
      });

      const { result } = renderHookWithApollo(
        () => useMealPlanItemActions('plan-1'),
        { operationMocks: [create.mock] },
      );

      let created: any;
      await act(async () => {
        created = await result.current.createItem({
          mealPlanId: 'plan-1',
          recipeId: 'r-1',
          mealType: 'DINNER',
          date: '2025-06-15',
        } as any);
      });

      expect(created).toBeNull();
      expect(mockToastError).toHaveBeenCalledWith('Conflict');
    });
  });

  describe('updateItem', () => {
    it('returns payload on success', async () => {
      const payload = {
        __typename: 'MealPlanItemPayload',
        success: true,
        message: 'Updated',
        mealPlanItem: { __typename: 'MealPlanItem', id: 'mpi-1' },
      };
      const update = recordMock(UpdateMealPlanItemDocument, {
        data: { updateMealPlanItem: payload },
      });

      const { result } = renderHookWithApollo(
        () => useMealPlanItemActions('plan-1'),
        { operationMocks: [update.mock] },
      );

      let updated: any;
      await act(async () => {
        updated = await result.current.updateItem('mpi-1', {
          servings: 3,
        } as any);
      });

      expect(updated).toEqual(payload);
    });
  });

  describe('toggleCompleted', () => {
    it('marks item as completed and shows toast', async () => {
      const update = recordMock(UpdateMealPlanItemDocument, {
        data: {
          updateMealPlanItem: {
            __typename: 'MealPlanItemPayload',
            success: true,
            message: 'Updated',
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
          id: 'mpi-1',
          input: expect.objectContaining({ isCompleted: true }),
        }),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith('Meal completed!');
    });

    it('shows deduction toast when deductFromPantry is true', async () => {
      const update = recordMock(UpdateMealPlanItemDocument, {
        data: {
          updateMealPlanItem: {
            __typename: 'MealPlanItemPayload',
            success: true,
            message: 'ok',
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
            __typename: 'MealPlanItemPayload',
            success: true,
            message: 'ok',
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
    it('returns true on success', async () => {
      const del = recordMock(DeleteMealPlanItemDocument, {
        data: {
          deleteMealPlanItem: { __typename: 'BasicPayload', success: true },
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
          deleteMealPlanItem: { __typename: 'BasicPayload', success: false },
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
