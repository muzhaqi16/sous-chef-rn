import { renderHook, act } from '@testing-library/react-native';
import { useMealPlanItemActions } from '../useMealPlanItemActions';

const mockCreateItemMutation = jest.fn();
const mockUpdateItemMutation = jest.fn();
const mockDeleteItemMutation = jest.fn();

jest.mock('#generated', () => ({
  useCreateMealPlanItemMutation: jest.fn(() => [mockCreateItemMutation, { loading: false }]),
  useUpdateMealPlanItemMutation: jest.fn(() => [mockUpdateItemMutation, { loading: false }]),
  useDeleteMealPlanItemMutation: jest.fn(() => [mockDeleteItemMutation, { loading: false }]),
  GetMealPlanDocument: 'GetMealPlanDocument',
}));

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

// Break circular dependency
jest.mock('../../../apollo/links/tokenScheduler', () => ({}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useMealPlanItemActions', () => {
  it('returns loading states all false initially', () => {
    const { result } = renderHook(() => useMealPlanItemActions('plan-1'));

    expect(result.current.loading).toBe(false);
    expect(result.current.creating).toBe(false);
    expect(result.current.updating).toBe(false);
    expect(result.current.deleting).toBe(false);
  });

  describe('createItem', () => {
    it('returns payload on success', async () => {
      const payload = {
        success: true,
        message: 'Created',
        mealPlanItem: { id: 'mpi-1' },
      };
      mockCreateItemMutation.mockResolvedValueOnce({
        data: { createMealPlanItem: payload },
      });

      const { result } = renderHook(() => useMealPlanItemActions('plan-1'));

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
      mockCreateItemMutation.mockResolvedValueOnce({
        data: { createMealPlanItem: { success: false, message: 'Conflict' } },
      });

      const { result } = renderHook(() => useMealPlanItemActions('plan-1'));

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
        success: true,
        message: 'Updated',
        mealPlanItem: { id: 'mpi-1' },
      };
      mockUpdateItemMutation.mockResolvedValueOnce({
        data: { updateMealPlanItem: payload },
      });

      const { result } = renderHook(() => useMealPlanItemActions('plan-1'));

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
    const mockItem = {
      id: 'mpi-1',
      isCompleted: false,
      recipe: { id: 'r-1', name: 'Pasta' },
      mealType: 'DINNER',
      date: '2025-06-15',
    };

    it('marks item as completed and shows toast', async () => {
      const payload = {
        success: true,
        message: 'Updated',
        mealPlanItem: { ...mockItem, isCompleted: true },
      };
      mockUpdateItemMutation.mockResolvedValueOnce({
        data: { updateMealPlanItem: payload },
      });

      const { result } = renderHook(() => useMealPlanItemActions('plan-1'));

      await act(async () => {
        await result.current.toggleCompleted(mockItem as any);
      });

      expect(mockUpdateItemMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            id: 'mpi-1',
            input: expect.objectContaining({
              isCompleted: true,
            }),
          }),
        }),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith('Meal completed!');
    });

    it('shows deduction toast when deductFromPantry is true', async () => {
      const payload = { success: true, message: 'ok' };
      mockUpdateItemMutation.mockResolvedValueOnce({
        data: { updateMealPlanItem: payload },
      });

      const { result } = renderHook(() => useMealPlanItemActions('plan-1'));

      await act(async () => {
        await result.current.toggleCompleted(mockItem as any, { deductFromPantry: true });
      });

      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Meal completed! Pantry items deducted.',
      );
    });

    it('does not show toast when un-completing', async () => {
      const completedItem = { ...mockItem, isCompleted: true };
      const payload = {
        success: true,
        message: 'ok',
        mealPlanItem: { ...completedItem, isCompleted: false },
      };
      mockUpdateItemMutation.mockResolvedValueOnce({
        data: { updateMealPlanItem: payload },
      });

      const { result } = renderHook(() => useMealPlanItemActions('plan-1'));

      await act(async () => {
        await result.current.toggleCompleted(completedItem as any);
      });

      // markingComplete is false, so no success toast
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });
  });

  describe('deleteItem', () => {
    it('returns true on success', async () => {
      mockDeleteItemMutation.mockResolvedValueOnce({
        data: { deleteMealPlanItem: { success: true } },
      });

      const { result } = renderHook(() => useMealPlanItemActions('plan-1'));

      let deleted: boolean | undefined;
      await act(async () => {
        deleted = await result.current.deleteItem('mpi-1');
      });

      expect(deleted).toBe(true);
    });

    it('returns false on failure', async () => {
      mockDeleteItemMutation.mockResolvedValueOnce({
        data: { deleteMealPlanItem: { success: false } },
      });

      const { result } = renderHook(() => useMealPlanItemActions('plan-1'));

      let deleted: boolean | undefined;
      await act(async () => {
        deleted = await result.current.deleteItem('mpi-1');
      });

      expect(deleted).toBe(false);
    });
  });
});
