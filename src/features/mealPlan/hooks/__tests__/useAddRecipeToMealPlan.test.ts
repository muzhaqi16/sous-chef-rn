import { renderHook, act } from '@testing-library/react-native';
import { MealType } from '#/graphql/generated/schemaTypes';
import type { toastService } from '#/services/toastService';
import { useAddRecipeToMealPlan } from '../useAddRecipeToMealPlan';

const mockCreateItem = jest.fn();

const mockMealPlansState = (overrides: Record<string, unknown> = {}) => ({
  state: {
    currentPlan: {
      id: 'plan-1',
      startDate: '2025-06-01T00:00:00Z',
      endDate: '2025-06-07T00:00:00Z',
    },
    mealPlans: [
      {
        id: 'plan-1',
        startDate: '2025-06-01T00:00:00Z',
        endDate: '2025-06-07T00:00:00Z',
      },
    ],
    loading: false,
    error: undefined,
    totalCount: undefined,
    hasMore: false,
    ...overrides,
  },
  actions: { refetch: jest.fn(), loadMore: jest.fn() },
});

jest.mock('../useMealPlans', () => ({
  useMealPlans: jest.fn(() => mockMealPlansState()),
}));

jest.mock('../useMealPlanItemActions', () => ({
  useMealPlanItemActions: jest.fn(() => ({
    createItem: mockCreateItem,
    creating: false,
  })),
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: {
    success: (...args: Parameters<typeof toastService.success>) =>
      mockToastSuccess(...args),
    error: (...args: Parameters<typeof toastService.error>) =>
      mockToastError(...args),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

// Break circular dependency
jest.mock('#/apollo/links/tokenScheduler');

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
    mockCreateItem.mockResolvedValueOnce({
      __typename: 'CreateMealPlanItemPayload',
      mealPlanItem: { __typename: 'MealPlanItem', id: 'mpi-1' },
    });

    const { result } = renderHook(() => useAddRecipeToMealPlan());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.addRecipeToMealPlan({
        recipeId: 'r-1',
        mealType: MealType.Dinner,
        date: new Date('2025-06-03'),
      });
    });

    expect(success).toBe(true);
    expect(mockCreateItem).toHaveBeenCalledWith(
      expect.objectContaining({
        mealPlanId: 'plan-1',
        meal: { recipeId: 'r-1' },
        mealType: 'DINNER',
      }),
    );
    expect(mockToastSuccess).toHaveBeenCalledWith('Added to meal plan');
  });

  it('addRecipeToMealPlan returns false on failure', async () => {
    mockCreateItem.mockResolvedValueOnce({ success: false });

    const { result } = renderHook(() => useAddRecipeToMealPlan());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.addRecipeToMealPlan({
        recipeId: 'r-1',
        mealType: MealType.Dinner,
        date: new Date('2025-06-03'),
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
});
