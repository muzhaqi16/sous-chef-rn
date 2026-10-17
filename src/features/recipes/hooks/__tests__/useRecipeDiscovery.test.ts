import { renderHook } from '@testing-library/react-native';
import { useFeatureFlag } from '#hooks/useFeatureFlag';
import { useRecipeDiscovery } from '../useRecipeDiscovery';
import { useServerRecipeSuggestions } from '../useServerRecipeSuggestions';
import {
  useSpoonacularDiscovery,
  type SpoonacularDiscoveryResult,
} from '../useSpoonacularDiscovery';

jest.mock('#hooks/useFeatureFlag', () => ({
  useFeatureFlag: jest.fn(() => true),
}));
jest.mock('../useServerRecipeSuggestions', () => ({
  useServerRecipeSuggestions: jest.fn(),
}));
jest.mock('../useSpoonacularDiscovery', () => ({
  useSpoonacularDiscovery: jest.fn(),
}));

const spoonacular: SpoonacularDiscoveryResult = {
  mode: 'random',
  items: [
    {
      id: '7',
      title: 'Spoonacular stew',
      subtitle: '',
    },
  ],
  loading: false,
  refresh: jest.fn(),
  pantryItems: [],
  hasPantryItems: false,
  pantryHasMore: false,
  pantryLoadingMore: false,
  loadMorePantryItems: jest.fn(),
  discoveryHasMore: true,
  loadMoreDiscovery: jest.fn(),
};

const server = (
  overrides: Partial<ReturnType<typeof useServerRecipeSuggestions>> = {},
): ReturnType<typeof useServerRecipeSuggestions> => ({
  items: [],
  loading: false,
  unanswered: false,
  refresh: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  jest.mocked(useFeatureFlag).mockReturnValue(true);
  jest.mocked(useSpoonacularDiscovery).mockReturnValue(spoonacular);
  jest.mocked(useServerRecipeSuggestions).mockReturnValue(server());
});

describe('useRecipeDiscovery', () => {
  it('is the Spoonacular discovery, untouched, with pantry suggestions switched off', () => {
    jest.mocked(useFeatureFlag).mockReturnValue(false);

    const { result } = renderHook(() => useRecipeDiscovery('vegan'));

    expect(result.current).toBe(spoonacular);
    expect(useServerRecipeSuggestions).toHaveBeenLastCalledWith(false);
    expect(useSpoonacularDiscovery).toHaveBeenLastCalledWith('vegan', {
      enabled: true,
    });
  });

  it("shows the server's ranking, one page, and keeps Spoonacular idle", () => {
    const ranked = server({
      items: [{ id: 'local-r-1', title: 'Curry', subtitle: '' }],
    });
    jest.mocked(useServerRecipeSuggestions).mockReturnValue(ranked);

    const { result } = renderHook(() => useRecipeDiscovery());

    expect(useSpoonacularDiscovery).toHaveBeenLastCalledWith(undefined, {
      enabled: false,
    });
    expect(result.current).toMatchObject({
      mode: 'pantry',
      items: ranked.items,
      discoveryHasMore: false,
      refresh: ranked.refresh,
    });
  });

  it('lets Spoonacular fill in when the server has nothing to suggest', () => {
    jest
      .mocked(useServerRecipeSuggestions)
      .mockReturnValue(server({ unanswered: true }));

    const { result } = renderHook(() => useRecipeDiscovery());

    expect(useSpoonacularDiscovery).toHaveBeenLastCalledWith(undefined, {
      enabled: true,
    });
    expect(result.current.items).toBe(spoonacular.items);
    expect(result.current.mode).toBe('random');
  });

  it('is loading while the server has not answered', () => {
    jest
      .mocked(useServerRecipeSuggestions)
      .mockReturnValue(server({ loading: true }));

    const { result } = renderHook(() => useRecipeDiscovery());

    expect(result.current.loading).toBe(true);
  });
});
