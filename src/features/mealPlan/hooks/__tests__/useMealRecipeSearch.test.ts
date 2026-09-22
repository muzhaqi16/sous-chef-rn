import { act, renderHook, waitFor } from '@testing-library/react-native';
import { spoonacularService } from '#/services/spoonacular/SpoonacularService';
import { useRecipeCacheStore } from '#features/recipes/store/useRecipeCacheStore';
import { useMealRecipeSearch } from '../useMealRecipeSearch';

jest.mock('#/services/spoonacular/SpoonacularService', () => ({
  spoonacularService: { searchRecipesWithInfo: jest.fn() },
}));

const searchRecipesWithInfo =
  spoonacularService.searchRecipesWithInfo as jest.Mock;

const result = (id: number, title: string) => ({ id, title, image: '' });

describe('useMealRecipeSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useRecipeCacheStore.getState().clearAllCache();
  });

  it('searches no shorter than three characters', () => {
    const { result: hook } = renderHook(() => useMealRecipeSearch());

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
    const { result: hook } = renderHook(() => useMealRecipeSearch());

    act(() => hook.current.search('pasta'));

    await waitFor(() => expect(hook.current.searching).toBe(false));
    expect(hook.current.results.map(r => r.title)).toEqual(['Pasta']);
  });

  it('clears results', async () => {
    searchRecipesWithInfo.mockResolvedValue({
      results: [result(1, 'Pasta')],
      totalResults: 1,
    });
    const { result: hook } = renderHook(() => useMealRecipeSearch());
    act(() => hook.current.search('pasta'));
    await waitFor(() => expect(hook.current.results).toHaveLength(1));

    act(() => hook.current.clear());

    expect(hook.current.results).toEqual([]);
  });
});
