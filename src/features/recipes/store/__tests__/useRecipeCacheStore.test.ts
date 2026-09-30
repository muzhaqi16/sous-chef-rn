import {
  useRecipeCacheStore,
  textSearchCacheKey,
  ingredientCacheKey,
} from '../useRecipeCacheStore';
import type { SearchRecipesResult } from '#/services/spoonacular/types';

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

  describe('getOrFetchResults (in-flight de-duplication)', () => {
    it('runs a single fetch for concurrent callers of the same key', async () => {
      const store = useRecipeCacheStore.getState();
      let resolve!: (v: SearchRecipesResult[]) => void;
      const fetcher = jest.fn(
        () => new Promise<SearchRecipesResult[]>(r => (resolve = r)),
      );

      const p1 = store.getOrFetchResults('ingredient:egg', fetcher);
      const p2 = store.getOrFetchResults('ingredient:egg', fetcher);

      // Second caller latched onto the first request — no duplicate fetch.
      expect(fetcher).toHaveBeenCalledTimes(1);

      resolve(sampleResults);
      await expect(p1).resolves.toEqual(sampleResults);
      await expect(p2).resolves.toEqual(sampleResults);
    });

    it('re-fetches once the previous request has settled', async () => {
      const store = useRecipeCacheStore.getState();
      const fetcher = jest.fn().mockResolvedValue(sampleResults);

      await store.getOrFetchResults('ingredient:egg', fetcher);
      await store.getOrFetchResults('ingredient:egg', fetcher);

      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('does not de-dupe across different keys', async () => {
      const store = useRecipeCacheStore.getState();
      const fetcher = jest.fn().mockResolvedValue(sampleResults);

      await Promise.all([
        store.getOrFetchResults('ingredient:egg', fetcher),
        store.getOrFetchResults('random:none', fetcher),
      ]);

      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('clears the in-flight entry on failure so the next call retries', async () => {
      const store = useRecipeCacheStore.getState();
      const fetcher = jest
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(sampleResults);

      await expect(
        store.getOrFetchResults('ingredient:egg', fetcher),
      ).rejects.toThrow('boom');
      await expect(
        store.getOrFetchResults('ingredient:egg', fetcher),
      ).resolves.toEqual(sampleResults);
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
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
