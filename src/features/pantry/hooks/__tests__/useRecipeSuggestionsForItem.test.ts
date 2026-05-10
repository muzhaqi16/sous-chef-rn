import { waitFor } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { useRecipeSuggestionsForItem } from '../useRecipeSuggestionsForItem';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';

const mockGetCachedSuggestions = jest.fn();
const mockSetCachedSuggestions = jest.fn();

jest.mock('#store/useRecipeSuggestionsStore', () => ({
  useRecipeSuggestionsStore: () => ({
    getCachedSuggestions: mockGetCachedSuggestions,
    setCachedSuggestions: mockSetCachedSuggestions,
  }),
}));

jest.mock('#/services/recipeApi/SpoonacularService', () => ({
  spoonacularService: {
    searchRecipes: jest.fn(),
  },
}));

const mockReportError = jest.fn();
jest.mock('#/services/errorService', () => ({
  errorService: {
    reportError: (...args: any[]) => mockReportError(...args),
  },
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeWithLoadingState: jest.fn(
    async (fn: any, setLoading: any, onError: any) => {
      setLoading(true);
      try {
        await fn();
      } catch (e) {
        onError?.(e);
      } finally {
        setLoading(false);
      }
    },
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCachedSuggestions.mockReturnValue(null);
});

describe('useRecipeSuggestionsForItem', () => {
  it('returns empty state when itemName is undefined', () => {
    const { result } = renderHookWithApollo(() =>
      useRecipeSuggestionsForItem(undefined),
    );

    expect(result.current.suggestedRecipes).toEqual([]);
    expect(result.current.loadingRecipes).toBe(false);
    expect(spoonacularService.searchRecipes).not.toHaveBeenCalled();
  });

  it('hits cache and skips API call on cache hit', async () => {
    const cached = [{ id: 1, title: 'Cached Recipe' }] as any;
    mockGetCachedSuggestions.mockReturnValue(cached);

    const { result } = renderHookWithApollo(() =>
      useRecipeSuggestionsForItem('Milk'),
    );

    await waitFor(() =>
      expect(result.current.suggestedRecipes).toEqual(cached),
    );
    expect(spoonacularService.searchRecipes).not.toHaveBeenCalled();
  });

  it('fetches from API and caches the result on cache miss', async () => {
    const apiResults = [{ id: 2, title: 'API Recipe' }];
    (spoonacularService.searchRecipes as jest.Mock).mockResolvedValueOnce({
      results: apiResults,
    });

    const { result } = renderHookWithApollo(() =>
      useRecipeSuggestionsForItem('Eggs'),
    );

    await waitFor(() =>
      expect(result.current.suggestedRecipes).toEqual(apiResults),
    );
    expect(spoonacularService.searchRecipes).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'Eggs',
        number: 5,
        addRecipeInformation: true,
      }),
      expect.any(AbortSignal),
    );
    expect(mockSetCachedSuggestions).toHaveBeenCalledWith('Eggs', apiResults);
  });

  it('reports non-abort errors to errorService', async () => {
    const err = new Error('Spoonacular down');
    (spoonacularService.searchRecipes as jest.Mock).mockRejectedValueOnce(err);

    renderHookWithApollo(() => useRecipeSuggestionsForItem('Bread'));

    await waitFor(() =>
      expect(mockReportError).toHaveBeenCalledWith(
        err,
        expect.objectContaining({
          operation: 'useRecipeSuggestionsForItem.fetch',
        }),
      ),
    );
  });

  it('does not report AbortError', async () => {
    const abortErr = Object.assign(new Error('aborted'), {
      name: 'AbortError',
    });
    (spoonacularService.searchRecipes as jest.Mock).mockRejectedValueOnce(
      abortErr,
    );

    renderHookWithApollo(() => useRecipeSuggestionsForItem('Cheese'));

    // Give the effect a tick
    await new Promise(r => setTimeout(r, 50));
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('toggles loadingRecipes around the fetch', async () => {
    let resolveFn: any;
    (spoonacularService.searchRecipes as jest.Mock).mockImplementationOnce(
      () =>
        new Promise(r => {
          resolveFn = r;
        }),
    );

    const { result } = renderHookWithApollo(() =>
      useRecipeSuggestionsForItem('Onion'),
    );

    await waitFor(() => expect(result.current.loadingRecipes).toBe(true));

    resolveFn({ results: [] });
    await waitFor(() => expect(result.current.loadingRecipes).toBe(false));
  });
});
