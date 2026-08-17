import { waitFor } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { useRecipeSuggestionsForItem } from '../useRecipeSuggestionsForItem';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import type { RecipeInformation } from '#/services/recipeApi/types';

const mockGetCachedSuggestions = jest.fn();
const mockSetCachedSuggestions = jest.fn();

jest.mock('#store/useRecipeSuggestionsStore', () => ({
  useRecipeSuggestionsStore: () => ({
    getCachedSuggestions: mockGetCachedSuggestions,
    setCachedSuggestions: mockSetCachedSuggestions,
  }),
}));

jest.mock('#/services/recipeApi/SpoonacularService', () => {
  const searchRecipes = jest.fn();
  return {
    spoonacularService: {
      searchRecipes,
      searchRecipesWithInfo: (...args: unknown[]) => {
        const [params, ...rest] = args;
        return searchRecipes(
          { ...(params as object), addRecipeInformation: true },
          ...rest,
        );
      },
    },
  };
});

const mockReportError = jest.fn();
jest.mock('#/services/errorService', () => ({
  errorService: {
    reportError: (
      error: unknown,
      context?: { operation?: string; [key: string]: unknown },
    ) => mockReportError(error, context),
  },
}));

jest.mock('#/utils/finallyHelpers', () => ({
  executeWithLoadingState: jest.fn(
    async (
      fn: () => Promise<void>,
      setLoading: (value: boolean) => void,
      onError?: (error: unknown) => void,
    ) => {
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
    const cached = [
      { id: 1, title: 'Cached Recipe' },
    ] as Partial<RecipeInformation>[] as RecipeInformation[];
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
    let resolveFn!: (value: { results: RecipeInformation[] }) => void;
    (spoonacularService.searchRecipes as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<{ results: RecipeInformation[] }>(r => {
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
