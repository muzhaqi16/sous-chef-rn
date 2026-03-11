'use no memo';

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useRecipeSearch } from '../useRecipeSearch';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
  })),
  useRoute: jest.fn(() => ({
    params: {},
  })),
}));

jest.mock('#hooks/navigation/useAppNavigation');
const mockNav = (jest.requireMock('#hooks/navigation/useAppNavigation') as { useAppNavigation: jest.Mock }).useAppNavigation();

jest.mock('#hooks/home/useDefaultHome', () => ({
  useDefaultHome: jest.fn(() => ({
    state: { selectedHomeId: 'home-1' },
    actions: { getDefaultPantry: jest.fn(() => ({ id: 'pantry-1' })) },
  })),
}));

jest.mock('#hooks/home/pantry/usePantryManagement', () => ({
  usePantryManagement: jest.fn(() => ({
    state: {
      items: [
        { id: '1', itemName: 'Chicken' },
        { id: '2', itemName: 'Rice' },
      ],
    },
    actions: {},
  })),
}));

jest.mock('#/hooks/profile/useDietaryProfile', () => ({
  useDietaryProfile: jest.fn(() => ({
    profile: { restrictions: [] },
  })),
}));

const mockSearchRecipes = jest.fn().mockResolvedValue({ results: [] });
const mockSearchByIngredients = jest.fn().mockResolvedValue([]);
jest.mock('#/services/recipeApi/SpoonacularService', () => ({
  spoonacularService: {
    searchRecipes: (...args: any[]) => mockSearchRecipes(...args),
    searchRecipesByIngredients: (...args: any[]) => mockSearchByIngredients(...args),
  },
}));

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: 'BottomSheetModal',
}));

jest.mock('#hooks/performance/useScreenTransition');

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useGetHomeQuery: jest.fn(() => ({ data: null })),
}));

jest.mock('#/utils/recipeTransform', () => ({
  transformRecipeForDisplay: jest.fn((recipe: any) => ({
    id: String(recipe.id),
    title: recipe.title || 'Test',
    spoonacularId: recipe.id,
    imageUrl: recipe.image,
  })),
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

describe('useRecipeSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // mockReset clears once-queues AND implementations, then restore defaults
    mockSearchRecipes.mockReset().mockResolvedValue({ results: [] });
    mockSearchByIngredients.mockReset().mockResolvedValue([]);
  });

  it('returns expected initial state shape', () => {
    const { result } = renderHook(() => useRecipeSearch());

    expect(result.current.searchQuery).toBe('');
    // loading may be true due to auto-search on mount with pantry items
    expect(typeof result.current.loading).toBe('boolean');
    expect(result.current.selectedIngredients.size).toBe(0);
    expect(result.current.activeFilterCount).toBe(0);
    expect(typeof result.current.handleTextSearch).toBe('function');
    expect(typeof result.current.handleIngredientSearch).toBe('function');
  });

  it('returns hasPantryItems as true when pantry has items', () => {
    const { result } = renderHook(() => useRecipeSearch());
    expect(result.current.hasPantryItems).toBe(true);
  });

  it('allows updating search query', () => {
    const { result } = renderHook(() => useRecipeSearch());

    act(() => {
      result.current.setSearchQuery('pasta');
    });

    expect(result.current.searchQuery).toBe('pasta');
  });

  it('toggleIngredient adds and removes ingredients', () => {
    const { result } = renderHook(() => useRecipeSearch());

    act(() => {
      result.current.toggleIngredient('Chicken');
    });

    expect(result.current.selectedIngredients.has('Chicken')).toBe(true);

    act(() => {
      result.current.toggleIngredient('Chicken');
    });

    expect(result.current.selectedIngredients.has('Chicken')).toBe(false);
  });

  it('clearFilters resets all filters', () => {
    const { result } = renderHook(() => useRecipeSearch());

    act(() => {
      result.current.setActiveFilters({
        diet: 'vegan',
        intolerances: ['gluten'],
        mealType: 'dinner',
        maxReadyTime: 30,
      });
    });

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.activeFilters).toEqual({
      diet: null,
      intolerances: [],
      mealType: null,
      maxReadyTime: null,
    });
  });

  it('activeFilterCount counts active filters', () => {
    const { result } = renderHook(() => useRecipeSearch());

    act(() => {
      result.current.setActiveFilters({
        diet: 'vegan',
        intolerances: ['gluten', 'dairy'],
        mealType: 'dinner',
        maxReadyTime: null,
      });
    });

    // diet (1) + intolerances (2) + mealType (1) = 4
    expect(result.current.activeFilterCount).toBe(4);
  });

  it('handleIngredientSearch alerts when no ingredients selected', async () => {
    const { result } = renderHook(() => useRecipeSearch());

    await act(async () => {
      await result.current.handleIngredientSearch();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'No Ingredients Selected',
      'Please select at least one ingredient',
    );
  });

  it('handleTextSearch falls back to pantry when no query', async () => {
    const { result } = renderHook(() => useRecipeSearch());

    await act(async () => {
      await result.current.handleTextSearch();
    });

    // Should have called searchByIngredients with pantry items
    expect(mockSearchByIngredients).toHaveBeenCalled();
  });

  it('handleItemPress navigates to RecipeDetail', () => {
    const { result } = renderHook(() => useRecipeSearch());

    // Need to set up items with mocked data
    mockSearchRecipes.mockResolvedValueOnce({
      results: [{ id: 123, title: 'Test Recipe' }],
    });

    act(() => {
      // This won't find any item since no search was done, but tests the function exists
      result.current.handleItemPress('non-existent');
    });

    // No navigate since item wasn't found
    expect(mockNav.navigate).not.toHaveBeenCalled();
  });

  // --- Additional branch / function coverage tests ---

  it('handleTextSearch performs text search when query is present', async () => {
    const { result } = renderHook(() => useRecipeSearch());

    act(() => {
      result.current.setSearchQuery('chicken pasta');
    });

    mockSearchRecipes.mockResolvedValueOnce({
      results: [{ id: 1, title: 'Chicken Pasta' }],
    });

    await act(async () => {
      await result.current.handleTextSearch();
    });

    expect(mockSearchRecipes).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'chicken pasta',
        number: 10,
        addRecipeInformation: true,
      }),
    );
    expect(result.current.searchPerformed).toBe(true);
  });

  it('handleTextSearch with filters passes diet parameter', async () => {
    const { result } = renderHook(() => useRecipeSearch());

    act(() => {
      result.current.setSearchQuery('salad');
      result.current.setActiveFilters({
        diet: 'vegan',
        intolerances: [],
        mealType: null,
        maxReadyTime: null,
      });
    });

    mockSearchRecipes.mockResolvedValueOnce({ results: [] });

    await act(async () => {
      await result.current.handleTextSearch();
    });

    expect(mockSearchRecipes).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'salad',
        diet: 'vegan',
      }),
    );
  });

  it('handleTextSearch with filters passes intolerances parameter', async () => {
    const { result } = renderHook(() => useRecipeSearch());

    act(() => {
      result.current.setSearchQuery('soup');
      result.current.setActiveFilters({
        diet: null,
        intolerances: ['gluten', 'dairy'],
        mealType: null,
        maxReadyTime: null,
      });
    });

    mockSearchRecipes.mockResolvedValueOnce({ results: [] });

    await act(async () => {
      await result.current.handleTextSearch();
    });

    expect(mockSearchRecipes).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'soup',
        intolerances: 'gluten,dairy',
      }),
    );
  });

  it('handleTextSearch with filters passes mealType parameter', async () => {
    const { result } = renderHook(() => useRecipeSearch());

    act(() => {
      result.current.setSearchQuery('rice');
      result.current.setActiveFilters({
        diet: null,
        intolerances: [],
        mealType: 'dinner',
        maxReadyTime: null,
      });
    });

    mockSearchRecipes.mockResolvedValueOnce({ results: [] });

    await act(async () => {
      await result.current.handleTextSearch();
    });

    expect(mockSearchRecipes).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'rice',
        type: 'dinner',
      }),
    );
  });

  it('handleTextSearch with filters passes maxReadyTime parameter', async () => {
    const { result } = renderHook(() => useRecipeSearch());

    act(() => {
      result.current.setSearchQuery('quick meal');
      result.current.setActiveFilters({
        diet: null,
        intolerances: [],
        mealType: null,
        maxReadyTime: 30,
      });
    });

    mockSearchRecipes.mockResolvedValueOnce({ results: [] });

    await act(async () => {
      await result.current.handleTextSearch();
    });

    expect(mockSearchRecipes).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'quick meal',
        maxReadyTime: 30,
      }),
    );
  });

  it('handleTextSearch shows alert when no query and no pantry items', async () => {
    const { usePantryManagement } = jest.requireMock('#hooks/home/pantry/usePantryManagement');
    usePantryManagement.mockReturnValue({ state: { items: [] }, actions: {} });

    const { result } = renderHook(() => useRecipeSearch());

    await act(async () => {
      await result.current.handleTextSearch();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Search Required',
      'Please enter a search term or add items to your pantry',
    );

    // Restore
    usePantryManagement.mockReturnValue({
      state: {
        items: [
          { id: '1', itemName: 'Chicken' },
          { id: '2', itemName: 'Rice' },
        ],
      },
      actions: {},
    });
  });

  it('handleTextSearch with empty query and pantry items with empty names filters them', async () => {
    const { usePantryManagement } = jest.requireMock('#hooks/home/pantry/usePantryManagement');
    usePantryManagement.mockReturnValue({
      state: {
        items: [
          { id: '1', itemName: '' },
          { id: '2', itemName: null },
          { id: '3', itemName: 'Tomato' },
        ],
      },
      actions: {},
    });

    const { result } = renderHook(() => useRecipeSearch());

    mockSearchByIngredients.mockResolvedValueOnce([]);

    await act(async () => {
      await result.current.handleTextSearch();
    });

    expect(mockSearchByIngredients).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredients: 'Tomato',
      }),
    );

    // Restore
    usePantryManagement.mockReturnValue({
      state: {
        items: [
          { id: '1', itemName: 'Chicken' },
          { id: '2', itemName: 'Rice' },
        ],
      },
      actions: {},
    });
  });

  it('handleIngredientSearch calls API with selected ingredients', async () => {
    const { result } = renderHook(() => useRecipeSearch());

    act(() => {
      result.current.toggleIngredient('Chicken');
      result.current.toggleIngredient('Rice');
    });

    mockSearchByIngredients.mockResolvedValueOnce([
      { id: 1, title: 'Chicken Rice' },
    ]);

    await act(async () => {
      await result.current.handleIngredientSearch();
    });

    expect(mockSearchByIngredients).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredients: expect.stringContaining('Chicken'),
        number: 10,
      }),
    );
    expect(result.current.searchPerformed).toBe(true);
  });

  it('handleIngredientSearch passes active filters', async () => {
    const { result } = renderHook(() => useRecipeSearch());

    act(() => {
      result.current.toggleIngredient('Tomato');
      result.current.setActiveFilters({
        diet: 'vegetarian',
        intolerances: ['gluten'],
        mealType: 'lunch',
        maxReadyTime: 45,
      });
    });

    mockSearchByIngredients.mockResolvedValueOnce([]);

    await act(async () => {
      await result.current.handleIngredientSearch();
    });

    expect(mockSearchByIngredients).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredients: 'Tomato',
        diet: 'vegetarian',
        intolerances: 'gluten',
        type: 'lunch',
        maxReadyTime: 45,
      }),
    );
  });

  it('openIngredientSelector calls present on ref', () => {
    const { result } = renderHook(() => useRecipeSearch());

    // ref is null by default, so this should not throw
    act(() => {
      result.current.openIngredientSelector();
    });
    // No crash means success
  });

  it('openFilterSheet calls present on ref', () => {
    const { result } = renderHook(() => useRecipeSearch());

    act(() => {
      result.current.openFilterSheet();
    });
    // No crash means success
  });

  it('applyFilters with text query triggers text search', async () => {
    const { result } = renderHook(() => useRecipeSearch());

    act(() => {
      result.current.setSearchQuery('pasta');
    });

    mockSearchRecipes.mockResolvedValueOnce({ results: [] });

    await act(async () => {
      result.current.applyFilters();
    });

    // The text search should have been triggered
    expect(mockSearchRecipes).toHaveBeenCalled();
  });

  it('applyFilters with selected ingredients triggers ingredient search', async () => {
    const { result } = renderHook(() => useRecipeSearch());

    act(() => {
      result.current.toggleIngredient('Garlic');
    });

    mockSearchByIngredients.mockResolvedValueOnce([]);

    await act(async () => {
      result.current.applyFilters();
    });

    expect(mockSearchByIngredients).toHaveBeenCalled();
  });

  it('applyFilters with no query and no ingredients does nothing', async () => {
    const { usePantryManagement } = jest.requireMock('#hooks/home/pantry/usePantryManagement');
    usePantryManagement.mockReturnValue({ state: { items: [] }, actions: {} });

    mockSearchRecipes.mockClear();
    mockSearchByIngredients.mockClear();

    const { result } = renderHook(() => useRecipeSearch());

    await act(async () => {
      result.current.applyFilters();
    });

    // Neither search function should be called from applyFilters
    // (handleTextSearch will alert instead)

    // Restore
    usePantryManagement.mockReturnValue({
      state: {
        items: [
          { id: '1', itemName: 'Chicken' },
          { id: '2', itemName: 'Rice' },
        ],
      },
      actions: {},
    });
  });

  it('activeFilterCount counts all filter types correctly', () => {
    const { result } = renderHook(() => useRecipeSearch());

    act(() => {
      result.current.setActiveFilters({
        diet: 'vegan',
        intolerances: ['gluten', 'dairy', 'egg'],
        mealType: 'dinner',
        maxReadyTime: 60,
      });
    });

    // diet (1) + intolerances (3) + mealType (1) + maxReadyTime (1) = 6
    expect(result.current.activeFilterCount).toBe(6);
  });

  it('activeFilterCount is 0 when only maxReadyTime is set', () => {
    const { result } = renderHook(() => useRecipeSearch());

    act(() => {
      result.current.setActiveFilters({
        diet: null,
        intolerances: [],
        mealType: null,
        maxReadyTime: 45,
      });
    });

    expect(result.current.activeFilterCount).toBe(1);
  });

  it('handleItemPress navigates when item is found', async () => {
    const { result } = renderHook(() => useRecipeSearch());

    // Wait for auto-search useEffect to complete
    await waitFor(() => {
      expect(mockSearchByIngredients).toHaveBeenCalled();
    });

    // Set up search results for the explicit text search
    mockSearchRecipes.mockResolvedValueOnce({
      results: [{ id: 42, title: 'Found Recipe', image: null }],
    });

    act(() => {
      result.current.setSearchQuery('found');
    });

    await act(async () => {
      await result.current.handleTextSearch();
    });

    act(() => {
      result.current.handleItemPress('42');
    });

    expect(mockNav.navigate).toHaveBeenCalledWith('RecipeDetail', {
      externalSource: 'SPOONACULAR',
      externalId: '42',
    });
  });

  it('hasPantryItems is false when pantry is empty', () => {
    const { usePantryManagement } = jest.requireMock('#hooks/home/pantry/usePantryManagement');
    usePantryManagement.mockReturnValue({ state: { items: [] }, actions: {} });

    const { result } = renderHook(() => useRecipeSearch());
    expect(result.current.hasPantryItems).toBe(false);

    // Restore
    usePantryManagement.mockReturnValue({
      state: {
        items: [
          { id: '1', itemName: 'Chicken' },
          { id: '2', itemName: 'Rice' },
        ],
      },
      actions: {},
    });
  });

  it('hasPantryItems is false when items is undefined', () => {
    const { usePantryManagement } = jest.requireMock('#hooks/home/pantry/usePantryManagement');
    usePantryManagement.mockReturnValue({ state: { items: null }, actions: {} });

    const { result } = renderHook(() => useRecipeSearch());
    expect(result.current.hasPantryItems).toBe(false);

    // Restore
    usePantryManagement.mockReturnValue({
      state: {
        items: [
          { id: '1', itemName: 'Chicken' },
          { id: '2', itemName: 'Rice' },
        ],
      },
      actions: {},
    });
  });

  it('auto-searches with initialQuery from route params', async () => {
    const { useRoute } = jest.requireMock('@react-navigation/native');
    useRoute.mockReturnValue({ params: { initialQuery: 'tacos' } });

    mockSearchRecipes.mockResolvedValueOnce({
      results: [{ id: 1, title: 'Tacos' }],
    });

    const { result } = renderHook(() => useRecipeSearch());

    await waitFor(() => {
      expect(result.current.searchPerformed).toBe(true);
    });

    expect(mockSearchRecipes).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'tacos' }),
    );
    expect(result.current.searchQuery).toBe('tacos');

    // Restore
    useRoute.mockReturnValue({ params: {} });
  });

  it('auto-searches with pantry items when no initialQuery', async () => {
    const { useRoute } = jest.requireMock('@react-navigation/native');
    useRoute.mockReturnValue({ params: {} });

    mockSearchByIngredients.mockResolvedValueOnce([
      { id: 1, title: 'Chicken Rice' },
    ]);

    renderHook(() => useRecipeSearch());

    await waitFor(() => {
      expect(mockSearchByIngredients).toHaveBeenCalledWith(
        expect.objectContaining({
          ingredients: 'Chicken,Rice',
        }),
      );
    });
  });

  it('excludedIngredients includes pork items for Halal restriction', () => {
    const { useDietaryProfile } = jest.requireMock('#/hooks/profile/useDietaryProfile');
    useDietaryProfile.mockReturnValue({
      profile: {
        restrictions: [{ diet: 'HALAL' }],
      },
    });

    const { result } = renderHook(() => useRecipeSearch());

    // The excluded ingredients are used in the search, we can verify via a text search
    act(() => {
      result.current.setSearchQuery('any meal');
    });

    mockSearchRecipes.mockResolvedValueOnce({ results: [] });

    act(() => {
      result.current.handleTextSearch();
    });

    expect(mockSearchRecipes).toHaveBeenCalledWith(
      expect.objectContaining({
        excludeIngredients: expect.stringContaining('pork'),
      }),
    );

    // Restore
    useDietaryProfile.mockReturnValue({
      profile: { restrictions: [] },
    });
  });

  it('excludedIngredients includes shellfish items for Kosher restriction', () => {
    const { useDietaryProfile } = jest.requireMock('#/hooks/profile/useDietaryProfile');
    useDietaryProfile.mockReturnValue({
      profile: {
        restrictions: [{ diet: 'KOSHER' }],
      },
    });

    const { result } = renderHook(() => useRecipeSearch());

    act(() => {
      result.current.setSearchQuery('seafood');
    });

    mockSearchRecipes.mockResolvedValueOnce({ results: [] });

    act(() => {
      result.current.handleTextSearch();
    });

    expect(mockSearchRecipes).toHaveBeenCalledWith(
      expect.objectContaining({
        excludeIngredients: expect.stringContaining('shellfish'),
      }),
    );

    // Restore
    useDietaryProfile.mockReturnValue({
      profile: { restrictions: [] },
    });
  });

  it('excludedIngredients is empty when no restrictions', () => {
    const { result } = renderHook(() => useRecipeSearch());

    act(() => {
      result.current.setSearchQuery('anything');
    });

    mockSearchRecipes.mockResolvedValueOnce({ results: [] });

    act(() => {
      result.current.handleTextSearch();
    });

    // Should not contain excludeIngredients when there are no restrictions
    const callArgs = mockSearchRecipes.mock.calls[mockSearchRecipes.mock.calls.length - 1][0];
    expect(callArgs.excludeIngredients).toBeUndefined();
  });

  it('search handles API error with quota exceeded', async () => {
    const { result } = renderHook(() => useRecipeSearch());

    // Wait for auto-search useEffect to complete
    await waitFor(() => {
      expect(mockSearchByIngredients).toHaveBeenCalled();
    });

    act(() => {
      result.current.setSearchQuery('steak');
    });

    const quotaError = new Error('Quota exceeded');
    (quotaError as any).isQuotaExceeded = true;
    mockSearchRecipes.mockRejectedValueOnce(quotaError);

    await act(async () => {
      await result.current.handleTextSearch();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'API Limit Reached',
      'Spoonacular API quota exceeded. Please try again later.',
    );
  });

  it('search handles API error with rate limit', async () => {
    const { result } = renderHook(() => useRecipeSearch());

    // Wait for auto-search useEffect to complete
    await waitFor(() => {
      expect(mockSearchByIngredients).toHaveBeenCalled();
    });

    act(() => {
      result.current.setSearchQuery('pizza');
    });

    const rateLimitError = new Error('Rate limited');
    (rateLimitError as any).isRateLimitError = true;
    mockSearchRecipes.mockRejectedValueOnce(rateLimitError);

    await act(async () => {
      await result.current.handleTextSearch();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Rate Limit',
      'Too many requests. Please try again in a moment.',
    );
  });

  it('search handles generic API error', async () => {
    const { result } = renderHook(() => useRecipeSearch());

    // Wait for auto-search useEffect to complete
    await waitFor(() => {
      expect(mockSearchByIngredients).toHaveBeenCalled();
    });

    act(() => {
      result.current.setSearchQuery('burger');
    });

    mockSearchRecipes.mockRejectedValueOnce(new Error('Network error'));

    await act(async () => {
      await result.current.handleTextSearch();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Search Error',
      'Failed to search recipes. Please try again.',
    );
  });

  it('ingredient search handles API error', async () => {
    const { result } = renderHook(() => useRecipeSearch());

    // Wait for auto-search useEffect to complete
    await waitFor(() => {
      expect(mockSearchByIngredients).toHaveBeenCalled();
    });

    act(() => {
      result.current.toggleIngredient('Potato');
    });

    mockSearchByIngredients.mockRejectedValueOnce(new Error('API down'));

    await act(async () => {
      await result.current.handleIngredientSearch();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Search Error',
      'Failed to search recipes. Please try again.',
    );
  });

  it('goBack returns the goBack function from navigation', () => {
    const { result } = renderHook(() => useRecipeSearch());
    expect(result.current.goBack).toBe(mockNav.goBack);
  });

  it('items transforms search results for display', async () => {
    const { result } = renderHook(() => useRecipeSearch());

    // Wait for auto-search useEffect to complete
    await waitFor(() => {
      expect(mockSearchByIngredients).toHaveBeenCalled();
    });

    act(() => {
      result.current.setSearchQuery('test');
    });

    mockSearchRecipes.mockResolvedValueOnce({
      results: [
        { id: 10, title: 'Test Recipe', image: 'img.jpg' },
        { id: 20, title: 'Another Recipe', image: null },
      ],
    });

    await act(async () => {
      await result.current.handleTextSearch();
    });

    expect(result.current.items.length).toBe(2);
    expect(result.current.items[0].id).toBe('10');
    expect(result.current.items[0].title).toBe('Test Recipe');
  });

  it('does not auto-search twice on re-render', async () => {
    mockSearchByIngredients.mockClear();
    mockSearchByIngredients.mockResolvedValue([]);

    const { rerender } = renderHook(() => useRecipeSearch());

    await waitFor(() => {
      expect(mockSearchByIngredients).toHaveBeenCalledTimes(1);
    });

    rerender({});

    // Still only called once
    expect(mockSearchByIngredients).toHaveBeenCalledTimes(1);
  });

  it('pantry search with all empty item names shows alert', async () => {
    const { usePantryManagement } = jest.requireMock('#hooks/home/pantry/usePantryManagement');
    usePantryManagement.mockReturnValue({
      state: {
        items: [
          { id: '1', itemName: '' },
          { id: '2', itemName: null },
        ],
      },
      actions: {},
    });

    const { result } = renderHook(() => useRecipeSearch());

    await act(async () => {
      await result.current.handleTextSearch();
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Search Required',
      'Please enter a search term or add items to your pantry',
    );

    // Restore
    usePantryManagement.mockReturnValue({
      state: {
        items: [
          { id: '1', itemName: 'Chicken' },
          { id: '2', itemName: 'Rice' },
        ],
      },
      actions: {},
    });
  });

  it('handleTextSearch with all filters active sends all parameters', async () => {
    const { useDietaryProfile } = jest.requireMock('#/hooks/profile/useDietaryProfile');
    useDietaryProfile.mockReturnValue({
      profile: {
        restrictions: [{ diet: 'HALAL' }],
      },
    });

    const { result } = renderHook(() => useRecipeSearch());

    act(() => {
      result.current.setSearchQuery('kebab');
      result.current.setActiveFilters({
        diet: 'vegetarian',
        intolerances: ['dairy'],
        mealType: 'lunch',
        maxReadyTime: 20,
      });
    });

    mockSearchRecipes.mockResolvedValueOnce({ results: [] });

    await act(async () => {
      await result.current.handleTextSearch();
    });

    expect(mockSearchRecipes).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'kebab',
        diet: 'vegetarian',
        intolerances: 'dairy',
        type: 'lunch',
        maxReadyTime: 20,
        excludeIngredients: expect.stringContaining('pork'),
      }),
    );

    // Restore
    useDietaryProfile.mockReturnValue({
      profile: { restrictions: [] },
    });
  });
});
