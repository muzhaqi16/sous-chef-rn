import { toastService } from '#/services/toastService';
import { renderHook, act } from '@testing-library/react-native';
import { MealType } from '#/graphql/generated/schemaTypes';
import { useAddRecipeToMealPlan } from '../useAddRecipeToMealPlan';

const mockCreateItem = jest.fn();
const mockLoadMore = jest.fn();

const mockMealPlansState = (overrides: Record<string, unknown> = {}) => ({
  state: {
    currentPlan: {
      id: 'plan-1',
      startDate: '2025-06-01',
      endDate: '2025-06-07',
    },
    mealPlans: [
      {
        id: 'plan-1',
        startDate: '2025-06-01',
        endDate: '2025-06-07',
      },
    ],
    loading: false,
    error: undefined,
    hasMore: false,
    loadingMore: false,
    ...overrides,
  },
  actions: { refetch: jest.fn(), loadMore: mockLoadMore },
});

jest.mock('../useMealPlans', () => ({
  useMealPlans: jest.fn(() => mockMealPlansState()),
  // The cache read by id, which does not care which page loaded the plan.
  useMealPlanDisplay: jest.fn((id: string | null) =>
    id
      ? {
          id,
          name: `Plan ${id}`,
          startDate: '2025-07-01',
          endDate: '2025-07-07',
        }
      : null,
  ),
}));

jest.mock('../useMealPlanItemActions', () => ({
  useMealPlanItemActions: jest.fn(() => ({
    createItem: mockCreateItem,
    creating: false,
  })),
}));

const mockToastSuccess = jest.mocked(toastService.success);
const mockToastError = jest.mocked(toastService.error);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useAddRecipeToMealPlan', () => {
  it('returns hasPlan true when an active plan exists', () => {
    const { result } = renderHook(() => useAddRecipeToMealPlan());

    expect(result.current.hasPlan).toBe(true);
    expect(result.current.activePlanId).toBe('plan-1');
  });

  it('returns adding state from item actions', () => {
    const { result } = renderHook(() => useAddRecipeToMealPlan());

    expect(result.current.adding).toBe(false);
  });

  it('addRecipeToMealPlan creates item and shows success toast', async () => {
    mockCreateItem.mockResolvedValueOnce(true);

    const { result } = renderHook(() => useAddRecipeToMealPlan());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.addRecipeToMealPlan({
        recipeId: 'r-1',
        mealType: MealType.Dinner,
        date: new Date(2025, 5, 3),
      });
    });

    expect(success).toBe(true);
    // The picked day as a `LocalDate` key, not an instant.
    expect(mockCreateItem).toHaveBeenCalledWith({
      mealPlanId: 'plan-1',
      meal: { recipeId: 'r-1' },
      mealType: 'DINNER',
      date: '2025-06-03',
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Added to meal plan');
  });

  // Local midnight is the previous UTC day east of UTC, and the last minute is
  // the next UTC day west of it: the picked LOCAL day is the one sent.
  it.each([
    ['its first minute', new Date(2025, 5, 3, 0, 0)],
    ['its last minute', new Date(2025, 5, 3, 23, 59)],
  ])(
    'addRecipeToMealPlan sends the picked local day at %s',
    async (_label, picked) => {
      mockCreateItem.mockResolvedValueOnce(true);
      const { result } = renderHook(() => useAddRecipeToMealPlan());

      await act(async () => {
        await result.current.addRecipeToMealPlan({
          recipeId: 'r-1',
          mealType: MealType.Dinner,
          date: picked,
        });
      });

      expect(mockCreateItem).toHaveBeenCalledWith(
        expect.objectContaining({ date: '2025-06-03' }),
      );
    },
  );

  it('addRecipeToMealPlan returns false on failure', async () => {
    mockCreateItem.mockResolvedValueOnce(false);

    const { result } = renderHook(() => useAddRecipeToMealPlan());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.addRecipeToMealPlan({
        recipeId: 'r-1',
        mealType: MealType.Dinner,
        date: new Date(2025, 5, 3),
      });
    });

    expect(success).toBe(false);
  });

  it('shows error toast when no active plan exists', async () => {
    const { useMealPlans } = require('../useMealPlans');
    useMealPlans.mockReturnValueOnce(
      mockMealPlansState({
        currentPlan: null,
        mealPlans: [],
      }),
    );

    const { result } = renderHook(() => useAddRecipeToMealPlan());

    expect(result.current.hasPlan).toBe(false);

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.addRecipeToMealPlan({
        recipeId: 'r-1',
        mealType: MealType.Dinner,
        date: new Date(),
      });
    });

    expect(success).toBe(false);
    expect(mockToastError).toHaveBeenCalledWith(
      'No active meal plan. Create one first.',
    );
  });

  it('uses specific planId from options when provided', () => {
    const { useMealPlans } = require('../useMealPlans');
    useMealPlans.mockReturnValueOnce(
      mockMealPlansState({
        currentPlan: { id: 'plan-1' },
        mealPlans: [
          { id: 'plan-1', startDate: '2025-06-01', endDate: '2025-06-07' },
          { id: 'plan-2', startDate: '2025-06-08', endDate: '2025-06-14' },
        ],
      }),
    );

    const { result } = renderHook(() =>
      useAddRecipeToMealPlan({ planId: 'plan-2' }),
    );

    expect(result.current.activePlanId).toBe('plan-2');
  });

  it('resolves a picked plan that is not in the loaded pages', () => {
    const { result } = renderHook(() =>
      useAddRecipeToMealPlan({ planId: 'plan-from-page-3' }),
    );

    expect(result.current.activePlan?.name).toBe('Plan plan-from-page-3');
    expect(result.current.hasPlan).toBe(true);
  });

  it('lists the current plan even when it is past the loaded pages', () => {
    const { useMealPlans } = require('../useMealPlans');
    useMealPlans.mockReturnValueOnce(
      mockMealPlansState({
        currentPlan: {
          id: 'current',
          startDate: '2025-06-01',
          endDate: '2025-06-07',
        },
        hasMore: true,
      }),
    );

    const { result } = renderHook(() => useAddRecipeToMealPlan());

    expect(result.current.mealPlans.map(plan => plan.id)).toEqual([
      'current',
      'plan-1',
    ]);
    expect(result.current.hasMorePlans).toBe(true);
    result.current.loadMorePlans();
    expect(mockLoadMore).toHaveBeenCalled();
  });
});
