import {
  useRecipeCacheStore,
  textSearchCacheKey,
  ingredientCacheKey,
  fetchRecipeInformation,
  fetchRecipePriceBreakdown,
} from '../useRecipeCacheStore';
import { spoonacularService } from '#/services/spoonacular/SpoonacularService';
import type {
  RecipeInformation,
  RecipePriceBreakdown,
  SearchRecipesResult,
} from '#/services/spoonacular/types';

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

  // Every Spoonacular request is billed.
  describe('recipe detail and price lookups', () => {
    const recipe = (id: number): RecipeInformation =>
      ({
        id,
        title: `Recipe ${id}`,
        image: '',
        imageType: 'jpg',
        servings: 2,
        readyInMinutes: 20,
        extendedIngredients: [],
      } as unknown as RecipeInformation);
    const breakdown: RecipePriceBreakdown = {
      ingredients: [],
      totalCost: 120,
      totalCostPerServing: 60,
    };
    let getInfo: jest.SpyInstance;
    let getPrice: jest.SpyInstance;

    beforeEach(() => {
      getInfo = jest
        .spyOn(spoonacularService, 'getRecipeInformation')
        .mockImplementation(({ id }) => Promise.resolve(recipe(id)));
      getPrice = jest
        .spyOn(spoonacularService, 'getRecipePriceBreakdown')
        .mockResolvedValue(breakdown);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('fetches a recipe once, with nutrition, and serves repeats from the cache', async () => {
      await fetchRecipeInformation(716429);
      const again = await fetchRecipeInformation(716429);

      expect(again.id).toBe(716429);
      expect(getInfo).toHaveBeenCalledTimes(1);
      expect(getInfo).toHaveBeenCalledWith({
        id: 716429,
        includeNutrition: true,
      });
    });

    it('shares one request between concurrent callers', async () => {
      await Promise.all([fetchRecipeInformation(1), fetchRecipeInformation(1)]);

      expect(getInfo).toHaveBeenCalledTimes(1);
    });

    it('fetches again once the entry is past the TTL', async () => {
      await fetchRecipeInformation(2);
      useRecipeCacheStore.setState(state => ({
        details: {
          ...state.details,
          '2': { data: recipe(2), cachedAt: Date.now() - 25 * 60 * 60 * 1000 },
        },
      }));

      await fetchRecipeInformation(2);

      expect(getInfo).toHaveBeenCalledTimes(2);
    });

    it('does not cache a failure, so the next call retries', async () => {
      getInfo.mockRejectedValueOnce(new Error('quota'));

      await expect(fetchRecipeInformation(3)).rejects.toThrow('quota');
      await expect(fetchRecipeInformation(3)).resolves.toMatchObject({
        id: 3,
      });
      expect(getInfo).toHaveBeenCalledTimes(2);
    });

    it('keeps every entry below the cap', async () => {
      for (let id = 1; id <= 30; id++) await fetchRecipeInformation(id);

      expect(Object.keys(useRecipeCacheStore.getState().details)).toHaveLength(
        30,
      );
    });

    it('evicts the oldest entries past the cap', async () => {
      const now = jest.spyOn(Date, 'now');
      for (let id = 1; id <= 42; id++) {
        now.mockReturnValue(1_000_000 + id);
        await fetchRecipeInformation(id);
      }

      const kept = Object.keys(useRecipeCacheStore.getState().details);
      expect(kept).toHaveLength(40);
      expect(kept).not.toContain('1');
      expect(kept).not.toContain('2');
      expect(kept).toContain('42');
    });

    it('rejects an aborted caller but still caches the result', async () => {
      const controller = new AbortController();
      const pending = fetchRecipeInformation(4, controller.signal);
      controller.abort();

      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
      await fetchRecipeInformation(4);
      expect(getInfo).toHaveBeenCalledTimes(1);
    });

    it('fetches a price breakdown once per recipe', async () => {
      await fetchRecipePriceBreakdown(716429);
      const again = await fetchRecipePriceBreakdown(716429);

      expect(again).toEqual(breakdown);
      expect(getPrice).toHaveBeenCalledTimes(1);
    });

    it('forgets both on a full reset', async () => {
      await fetchRecipeInformation(5);
      await fetchRecipePriceBreakdown(5);

      useRecipeCacheStore.getState().clearAllCache();
      await fetchRecipeInformation(5);
      await fetchRecipePriceBreakdown(5);

      expect(getInfo).toHaveBeenCalledTimes(2);
      expect(getPrice).toHaveBeenCalledTimes(2);
    });
  });
});
