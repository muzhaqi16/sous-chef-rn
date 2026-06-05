import {
  useRecipeCacheStore,
  textSearchCacheKey,
  ingredientCacheKey,
} from '../useRecipeCacheStore';
import type { SearchRecipesResult } from '#/services/recipeApi/types';

const sampleResults: SearchRecipesResult[] = [
  {
    id: 7001,
    title: 'Pasta Carbonara',
    image: 'https://img/7001.jpg',
    imageType: 'jpg',
  },
];

describe('useRecipeCacheStore', () => {
  beforeEach(() => {
    useRecipeCacheStore.getState().clearAllCache();
  });

  it('round-trips non-empty results', () => {
    const store = useRecipeCacheStore.getState();
    store.setCached('text:pasta', sampleResults);

    const cached = useRecipeCacheStore.getState().getCached('text:pasta');
    expect(cached?.results).toEqual(sampleResults);
  });

  it('does not cache empty result sets', () => {
    const store = useRecipeCacheStore.getState();
    store.setCached('text:nothing', []);

    expect(useRecipeCacheStore.getState().getCached('text:nothing')).toBeNull();
    // No entry was written at all
    expect(
      useRecipeCacheStore.getState().cache['text:nothing'],
    ).toBeUndefined();
  });

  it('treats a persisted empty entry as a miss and purges it', () => {
    // Simulate an entry persisted to MMKV before the empty-guard existed
    useRecipeCacheStore.setState(state => ({
      cache: {
        ...state.cache,
        'text:stale': { results: [], enrichment: {}, cachedAt: Date.now() },
      },
    }));

    expect(useRecipeCacheStore.getState().getCached('text:stale')).toBeNull();
    expect(useRecipeCacheStore.getState().cache['text:stale']).toBeUndefined();
  });

  it('expires entries past the 24h TTL', () => {
    const dayAndAnHourAgo = Date.now() - 25 * 60 * 60 * 1000;
    useRecipeCacheStore.setState(state => ({
      cache: {
        ...state.cache,
        'text:old': {
          results: sampleResults,
          enrichment: {},
          cachedAt: dayAndAnHourAgo,
        },
      },
    }));

    expect(useRecipeCacheStore.getState().getCached('text:old')).toBeNull();
  });

  describe('cache keys', () => {
    it('normalizes text search keys with sorted filters', () => {
      expect(
        textSearchCacheKey('  Pasta ', {
          diet: ['vegan', 'paleo'],
          intolerances: ['soy'],
          mealType: 'dinner',
          maxReadyTime: 30,
        }),
      ).toBe('text:pasta|diet:paleo,vegan|intol:soy|type:dinner|time:30');
    });

    it('omits empty filter segments', () => {
      expect(textSearchCacheKey('pasta')).toBe('text:pasta');
    });

    it('normalizes ingredient keys to sorted lowercase', () => {
      expect(ingredientCacheKey('Tomato, basil')).toBe(
        'ingredient:basil,tomato',
      );
    });
  });
});
