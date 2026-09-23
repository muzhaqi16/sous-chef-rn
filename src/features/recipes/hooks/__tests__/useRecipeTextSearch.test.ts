import { act, renderHook, waitFor } from '@testing-library/react-native';
import { spoonacularService } from '#/services/spoonacular/SpoonacularService';
import {
  textSearchCacheKey,
  useRecipeCacheStore,
} from '#features/recipes/store/useRecipeCacheStore';
import { SEARCH_FETCH_SIZE } from '#features/recipes/utils/recipeSearchPaging';
import { useRecipeTextSearch } from '../useRecipeTextSearch';

jest.mock('#/services/spoonacular/SpoonacularService', () => ({
  spoonacularService: { searchRecipesWithInfo: jest.fn() },
}));

const searchRecipesWithInfo =
  spoonacularService.searchRecipesWithInfo as jest.Mock;

const result = (id: number, title: string) => ({ id, title, image: '' });

describe('useRecipeTextSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useRecipeCacheStore.getState().clearAllCache();
  });

  it('searches no shorter than three characters', () => {
    const { result: hook } = renderHook(() => useRecipeTextSearch());

    act(() => hook.current.search('ab'));

    expect(searchRecipesWithInfo).not.toHaveBeenCalled();
    expect(hook.current.results).toEqual([]);
    expect(hook.current.searching).toBe(false);
  });

  it('returns transformed results and settles searching', async () => {
    searchRecipesWithInfo.mockResolvedValue({
      results: [result(1, 'Pasta')],
      totalResults: 1,
    });
    const { result: hook } = renderHook(() => useRecipeTextSearch());

    act(() => hook.current.search('pasta'));

    await waitFor(() => expect(hook.current.searching).toBe(false));
    expect(hook.current.results.map(r => r.title)).toEqual(['Pasta']);
  });

  it('clears results', async () => {
    searchRecipesWithInfo.mockResolvedValue({
      results: [result(1, 'Pasta')],
      totalResults: 1,
    });
    const { result: hook } = renderHook(() => useRecipeTextSearch());
    act(() => hook.current.search('pasta'));
    await waitFor(() => expect(hook.current.results).toHaveLength(1));

    act(() => hook.current.clear());

    expect(hook.current.results).toEqual([]);
  });

  // The Recipes tab reads the same cache key for its first page and pages on
  // its total, so this search must store a full page with the total.
  it('caches the full first page the Recipes tab reads', async () => {
    searchRecipesWithInfo.mockResolvedValue({
      results: [result(1, 'Pasta')],
      totalResults: 40,
    });
    const { result: hook } = renderHook(() => useRecipeTextSearch());

    act(() => hook.current.search('pasta'));
    await waitFor(() => expect(hook.current.searching).toBe(false));

    expect(searchRecipesWithInfo).toHaveBeenCalledWith(
      expect.objectContaining({ number: SEARCH_FETCH_SIZE, offset: 0 }),
      expect.anything(),
    );
    const cached = useRecipeCacheStore
      .getState()
      .getCached(textSearchCacheKey('pasta'));
    expect(cached?.totalResults).toBe(40);
  });
});
