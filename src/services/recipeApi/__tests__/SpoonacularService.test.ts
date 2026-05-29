jest.mock('#/config/env', () => ({
  env: { SPOONACULAR_API_KEY: 'test-api-key' },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import { spoonacularService } from '../SpoonacularService';
import { logger } from '#/utils/environment';

describe('SpoonacularService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    spoonacularService.resetRequestCount();
  });

  describe('searchRecipesByIngredients', () => {
    it('calls fetch with correct URL and params', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ id: 1, title: 'Test Recipe' }]),
      });

      await spoonacularService.searchRecipesByIngredients({
        ingredients: 'chicken,rice',
        number: 5,
        ranking: 1,
        ignorePantry: true,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = new URL(mockFetch.mock.calls[0][0]);
      expect(calledUrl.pathname).toBe('/recipes/findByIngredients');
      expect(calledUrl.searchParams.get('apiKey')).toBe('test-api-key');
      expect(calledUrl.searchParams.get('ingredients')).toBe('chicken,rice');
      expect(calledUrl.searchParams.get('number')).toBe('5');
      expect(calledUrl.searchParams.get('ranking')).toBe('1');
      expect(calledUrl.searchParams.get('ignorePantry')).toBe('true');
    });

    it('caps number at 100', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await spoonacularService.searchRecipesByIngredients({
        ingredients: 'chicken',
        number: 150,
      });

      const calledUrl = new URL(mockFetch.mock.calls[0][0]);
      expect(calledUrl.searchParams.get('number')).toBe('100');
    });
  });

  describe('getRecipeInformation', () => {
    it('includes nutrition by default', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1, title: 'Test Recipe' }),
      });

      await spoonacularService.getRecipeInformation({ id: 123 });

      const calledUrl = new URL(mockFetch.mock.calls[0][0]);
      expect(calledUrl.pathname).toBe('/recipes/123/information');
      expect(calledUrl.searchParams.get('includeNutrition')).toBe('true');
    });
  });

  describe('searchRecipes', () => {
    it('caps number at 100', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [],
            offset: 0,
            number: 100,
            totalResults: 0,
          }),
      });

      await spoonacularService.searchRecipes({ query: 'pasta', number: 150 });

      const calledUrl = new URL(mockFetch.mock.calls[0][0]);
      expect(calledUrl.searchParams.get('number')).toBe('100');
    });
  });

  describe('getRandomRecipes', () => {
    it('returns response.recipes', async () => {
      const recipes = [
        { id: 1, title: 'Random Recipe 1' },
        { id: 2, title: 'Random Recipe 2' },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ recipes }),
      });

      const result = await spoonacularService.getRandomRecipes();

      expect(result).toEqual(recipes);
    });
  });

  describe('getBulkRecipeInformation', () => {
    it('joins IDs with comma', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await spoonacularService.getBulkRecipeInformation([1, 2, 3]);

      const calledUrl = new URL(mockFetch.mock.calls[0][0]);
      expect(calledUrl.pathname).toBe('/recipes/informationBulk');
      expect(calledUrl.searchParams.get('ids')).toBe('1,2,3');
    });
  });

  describe('rate limiting', () => {
    it('warns when approaching 90% of daily limit (135 requests)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      // Make 135 requests so requestCount reaches 135
      for (let i = 0; i < 135; i++) {
        await spoonacularService.searchRecipesByIngredients({
          ingredients: 'chicken',
        });
      }

      // The 136th request triggers checkRateLimit which sees requestCount=135
      // and 135 >= 150 * 0.9 (135), so it warns
      await spoonacularService.searchRecipesByIngredients({
        ingredients: 'chicken',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Approaching Spoonacular daily limit'),
      );
    });
  });

  describe('error handling', () => {
    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        spoonacularService.searchRecipesByIngredients({
          ingredients: 'chicken',
        }),
      ).rejects.toThrow('Spoonacular API error');
    });

    it('402 status sets isQuotaExceeded flag', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 402,
        statusText: 'Payment Required',
      });

      try {
        await spoonacularService.searchRecipesByIngredients({
          ingredients: 'chicken',
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.isQuotaExceeded).toBe(true);
        expect(error.message).toBe('Spoonacular API quota exceeded');
      }
    });

    it('429 status sets isRateLimitError flag', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      try {
        await spoonacularService.searchRecipesByIngredients({
          ingredients: 'chicken',
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.isRateLimitError).toBe(true);
        expect(error.message).toBe('Spoonacular API rate limit exceeded');
      }
    });
  });

  describe('request tracking', () => {
    it('getRequestCount returns current count', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      expect(spoonacularService.getRequestCount()).toBe(0);

      await spoonacularService.searchRecipesByIngredients({
        ingredients: 'chicken',
      });

      expect(spoonacularService.getRequestCount()).toBe(1);
    });

    it('resetRequestCount resets to 0', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await spoonacularService.searchRecipesByIngredients({
        ingredients: 'chicken',
      });
      expect(spoonacularService.getRequestCount()).toBe(1);

      spoonacularService.resetRequestCount();
      expect(spoonacularService.getRequestCount()).toBe(0);
    });

    it('getRemainingRequests returns dailyLimit minus requestCount', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      expect(spoonacularService.getRemainingRequests()).toBe(150);

      await spoonacularService.searchRecipesByIngredients({
        ingredients: 'chicken',
      });

      expect(spoonacularService.getRemainingRequests()).toBe(149);
    });
  });
});
