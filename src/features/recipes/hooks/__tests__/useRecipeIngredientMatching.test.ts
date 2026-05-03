import { renderHook, act } from '@testing-library/react-native';
import {
  useRecipeIngredientMatching,
  getAvailabilityStatus,
} from '../useRecipeIngredientMatching';

// --- Mock Apollo hooks ---
const mockLoadMatchesQuery = jest.fn();
const mockConfirmMutation = jest.fn();

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useMatchRecipeIngredientsToPantryLazyQuery: jest.fn(() => [
    mockLoadMatchesQuery,
    { loading: false },
  ]),
  useConfirmRecipeConsumptionMutation: jest.fn(() => [
    mockConfirmMutation,
    { loading: false },
  ]),
}));

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (s: any) => any) =>
    selector({ selectedPantryId: 'pantry-1' }),
  useSelectedPantryId: jest.fn(() => 'pantry-1'),
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockToastInfo = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
    info: (...args: any[]) => mockToastInfo(...args),
    warning: jest.fn(),
  },
}));

jest.mock('#/services/telemetry', () => ({
  Telemetry: { trackEvent: jest.fn() },
}));

jest.mock('#/utils/compilerSafeWrappers');

// Break circular dependency
jest.mock('#/apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------- Pure function tests ----------

describe('getAvailabilityStatus', () => {
  it('returns "available" when isAvailable and confidence >= 0.8', () => {
    expect(
      getAvailabilityStatus({
        isAvailable: true,
        matchConfidence: 0.9,
        matchedPantryItem: { id: 'pi-1' },
        availableQuantity: 2,
      } as any),
    ).toBe('available');
  });

  it('returns "partial" when pantry item exists, not available, but quantity > 0', () => {
    expect(
      getAvailabilityStatus({
        isAvailable: false,
        matchConfidence: 0.5,
        matchedPantryItem: { id: 'pi-1' },
        availableQuantity: 1,
      } as any),
    ).toBe('partial');
  });

  it('returns "missing" when no pantry item matched', () => {
    expect(
      getAvailabilityStatus({
        isAvailable: false,
        matchConfidence: 0,
        matchedPantryItem: null,
        availableQuantity: 0,
      } as any),
    ).toBe('missing');
  });
});

// ---------- Hook tests ----------

describe('useRecipeIngredientMatching', () => {
  it('returns initial state with hasPantry true when pantryId exists', () => {
    const { result } = renderHook(() =>
      useRecipeIngredientMatching('recipe-1'),
    );

    expect(result.current.hasPantry).toBe(true);
    expect(result.current.editableMatches).toEqual([]);
    expect(result.current.isSheetVisible).toBe(false);
    expect(result.current.matchSummary).toEqual({
      total: 0,
      available: 0,
      partial: 0,
      missing: 0,
      included: 0,
    });
  });

  it('loadMatches shows error when recipeId is undefined', async () => {
    const { result } = renderHook(() => useRecipeIngredientMatching(undefined));

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.loadMatches(4);
    });

    expect(success).toBe(false);
    expect(mockToastError).toHaveBeenCalledWith(
      'Recipe or pantry not available',
    );
  });

  it('loadMatches populates editableMatches on success', async () => {
    const matches = [
      {
        ingredient: { id: 'ing-1', isOptional: false, unit: { id: 'u1' } },
        isAvailable: true,
        matchConfidence: 0.95,
        matchedPantryItem: { id: 'pi-1' },
        availableQuantity: 5,
        suggestedQuantity: 2,
        suggestedUnit: { id: 'su-1' },
      },
    ];

    mockLoadMatchesQuery.mockResolvedValueOnce({
      data: { matchRecipeIngredientsToPantry: matches },
    });

    const { result } = renderHook(() =>
      useRecipeIngredientMatching('recipe-1'),
    );

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.loadMatches(4);
    });

    expect(success).toBe(true);
    expect(result.current.editableMatches).toHaveLength(1);
    expect(result.current.editableMatches[0].adjustedQuantity).toBe(2);
    expect(result.current.isSheetVisible).toBe(true);
  });

  it('updateMatch updates a specific match entry', async () => {
    const matches = [
      {
        ingredient: { id: 'ing-1', isOptional: false, unit: { id: 'u1' } },
        isAvailable: true,
        matchConfidence: 0.9,
        matchedPantryItem: { id: 'pi-1' },
        availableQuantity: 5,
        suggestedQuantity: 2,
        suggestedUnit: { id: 'su-1' },
      },
    ];

    mockLoadMatchesQuery.mockResolvedValueOnce({
      data: { matchRecipeIngredientsToPantry: matches },
    });

    const { result } = renderHook(() =>
      useRecipeIngredientMatching('recipe-1'),
    );

    await act(async () => {
      await result.current.loadMatches(4);
    });

    act(() => {
      result.current.updateMatch(0, { adjustedQuantity: 10 });
    });

    expect(result.current.editableMatches[0].adjustedQuantity).toBe(10);
  });

  it('closeSheet hides the sheet', async () => {
    const matches = [
      {
        ingredient: { id: 'ing-1', isOptional: false, unit: { id: 'u1' } },
        isAvailable: true,
        matchConfidence: 0.9,
        matchedPantryItem: { id: 'pi-1' },
        availableQuantity: 5,
        suggestedQuantity: 2,
        suggestedUnit: { id: 'su-1' },
      },
    ];

    mockLoadMatchesQuery.mockResolvedValueOnce({
      data: { matchRecipeIngredientsToPantry: matches },
    });

    const { result } = renderHook(() =>
      useRecipeIngredientMatching('recipe-1'),
    );

    await act(async () => {
      await result.current.loadMatches(4);
    });

    expect(result.current.isSheetVisible).toBe(true);

    act(() => {
      result.current.closeSheet();
    });

    expect(result.current.isSheetVisible).toBe(false);
  });

  it('matchSummary computes counts correctly', async () => {
    const matches = [
      {
        ingredient: { id: 'ing-1', isOptional: false, unit: { id: 'u1' } },
        isAvailable: true,
        matchConfidence: 0.9,
        matchedPantryItem: { id: 'pi-1' },
        availableQuantity: 5,
        suggestedQuantity: 2,
        suggestedUnit: { id: 'su-1' },
      },
      {
        ingredient: { id: 'ing-2', isOptional: false, unit: { id: 'u2' } },
        isAvailable: false,
        matchConfidence: 0.3,
        matchedPantryItem: { id: 'pi-2' },
        availableQuantity: 1,
        suggestedQuantity: 3,
        suggestedUnit: null,
      },
      {
        ingredient: { id: 'ing-3', isOptional: true, unit: { id: 'u3' } },
        isAvailable: false,
        matchConfidence: 0,
        matchedPantryItem: null,
        availableQuantity: 0,
        suggestedQuantity: 1,
        suggestedUnit: null,
      },
    ];

    mockLoadMatchesQuery.mockResolvedValueOnce({
      data: { matchRecipeIngredientsToPantry: matches },
    });

    const { result } = renderHook(() =>
      useRecipeIngredientMatching('recipe-1'),
    );

    await act(async () => {
      await result.current.loadMatches(4);
    });

    expect(result.current.matchSummary).toEqual({
      total: 3,
      available: 1,
      partial: 1,
      missing: 1,
      included: 2, // ing-1 (not optional, has pantry item), ing-2 (not optional, has pantry item)
    });
  });
});
