import { renderHook } from '@testing-library/react-native';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import {
  Diet,
  ExternalSource,
  Intolerance,
} from '#/graphql/generated/schemaTypes';
import type { RecipeRow } from '#features/recipes/utils/recipeRows';
import { useRecipeDiscovery } from '../useRecipeDiscovery';
import { useServerRecipeSuggestions } from '../useServerRecipeSuggestions';
import {
  useCatalogDiscovery,
  type CatalogDiscoveryResult,
  type DiscoveryDiet,
} from '../useCatalogDiscovery';

jest.mock('#hooks/settings/useFeatureFlag', () => ({
  useFeatureFlag: jest.fn(() => true),
}));
jest.mock('../useServerRecipeSuggestions', () => ({
  useServerRecipeSuggestions: jest.fn(),
}));
jest.mock('../useCatalogDiscovery', () => ({
  useCatalogDiscovery: jest.fn(),
}));

const DIET: DiscoveryDiet = {
  diets: [Diet.Vegan],
  intolerances: [Intolerance.Peanut],
};

const randomRow = (providerRecipeId: string, name: string): RecipeRow => ({
  source: 'random',
  hit: {
    __typename: 'CatalogRecipeHit',
    provider: ExternalSource.Spoonacular,
    providerRecipeId,
    name,
    imageUrl: null,
    servings: 4,
    totalTimeMinutes: null,
    likes: null,
  },
});

const catalog: CatalogDiscoveryResult = {
  mode: 'random',
  rows: [randomRow('7', 'Catalog stew')],
  loading: false,
  refreshing: false,
  failed: false,
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
  rows: [],
  loading: false,
  refreshing: false,
  unanswered: false,
  refresh: jest.fn(),
  ...overrides,
});

beforeEach(() => {
  jest.mocked(useFeatureFlag).mockReturnValue(true);
  jest.mocked(useCatalogDiscovery).mockReturnValue(catalog);
  jest.mocked(useServerRecipeSuggestions).mockReturnValue(server());
});

describe('useRecipeDiscovery', () => {
  it('is the catalog discovery, untouched, with pantry suggestions switched off', () => {
    jest.mocked(useFeatureFlag).mockReturnValue(false);

    const { result } = renderHook(() => useRecipeDiscovery(DIET));

    expect(result.current).toBe(catalog);
    expect(useServerRecipeSuggestions).toHaveBeenLastCalledWith(false);
    expect(useCatalogDiscovery).toHaveBeenLastCalledWith(DIET, {
      enabled: true,
    });
  });

  it("shows the server's ranking, one page, and keeps the catalog idle", () => {
    const ranked = server({ rows: [randomRow('1', 'Curry')] });
    jest.mocked(useServerRecipeSuggestions).mockReturnValue(ranked);

    const { result } = renderHook(() => useRecipeDiscovery(DIET));

    expect(useCatalogDiscovery).toHaveBeenLastCalledWith(DIET, {
      enabled: false,
    });
    expect(result.current).toMatchObject({
      mode: 'pantry',
      rows: ranked.rows,
      discoveryHasMore: false,
      refresh: ranked.refresh,
    });
  });

  it('lets the catalog fill in when the server has nothing to suggest', () => {
    jest
      .mocked(useServerRecipeSuggestions)
      .mockReturnValue(server({ unanswered: true }));

    const { result } = renderHook(() => useRecipeDiscovery(DIET));

    expect(useCatalogDiscovery).toHaveBeenLastCalledWith(DIET, {
      enabled: true,
    });
    expect(result.current.rows).toBe(catalog.rows);
    expect(result.current.mode).toBe('random');
  });

  it('is loading while the server has not answered', () => {
    jest
      .mocked(useServerRecipeSuggestions)
      .mockReturnValue(server({ loading: true }));

    const { result } = renderHook(() => useRecipeDiscovery(DIET));

    expect(result.current.loading).toBe(true);
  });
});
