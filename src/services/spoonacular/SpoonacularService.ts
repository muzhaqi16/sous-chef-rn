import { env } from '#/config/env';
import { logger } from '#/utils/environment';
import type {
  SearchRecipesByIngredientsParams,
  RecipeSearchResult,
  GetRecipeInformationParams,
  RecipeInformation,
  SearchRecipesParams,
  SearchRecipesParamsWithInfo,
  SearchRecipesParamsWithoutInfo,
  SearchRecipesResponse,
  SearchRecipesResponseWithInfo,
  GetRandomRecipesParams,
  GetRandomRecipesResponse,
  RecipePriceBreakdown,
  SpoonacularApiError,
} from './types';

const BASE_URL = 'https://api.spoonacular.com';

/** Spoonacular API client. Free tier allows 150 requests/day. */
class SpoonacularService {
  private apiKey: string;
  private requestCount: number = 0;
  private dailyLimit: number = 150;

  constructor() {
    this.apiKey = env.SPOONACULAR_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('Spoonacular API key not configured');
    }
  }

  private checkRateLimit(): void {
    if (this.requestCount >= this.dailyLimit) {
      logger.warn('Spoonacular daily request limit reached or exceeded');
    } else if (this.requestCount >= this.dailyLimit * 0.9) {
      logger.warn(
        `Approaching Spoonacular daily limit: ${this.requestCount}/${this.dailyLimit}`,
      );
    }
  }

  private async fetch<T>(
    endpoint: string,
    params: Record<string, unknown> = {},
    signal?: AbortSignal,
  ): Promise<T> {
    this.checkRateLimit();

    const url = new URL(`${BASE_URL}${endpoint}`);
    url.searchParams.append('apiKey', this.apiKey);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    try {
      this.requestCount++;
      logger.debug('Spoonacular API request:', endpoint, params);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal,
      });

      if (!response.ok) {
        const error: SpoonacularApiError = new Error(
          `Spoonacular API error: ${response.status} ${response.statusText}`,
        );
        error.status = response.status;

        if (response.status === 402) {
          error.isQuotaExceeded = true;
          error.message = 'Spoonacular API quota exceeded';
          logger.error('Spoonacular quota exceeded');
        } else if (response.status === 429) {
          error.isRateLimitError = true;
          error.message = 'Spoonacular API rate limit exceeded';
          logger.error('Spoonacular rate limit exceeded');
        }

        throw error;
      }

      const data = await response.json();
      // A shape summary, not the raw payload: serializing a 25-result
      // findByIngredients response can block the JS thread for seconds.
      logger.debug(
        'Spoonacular API response:',
        Array.isArray(data)
          ? { resultCount: data.length }
          : { keys: Object.keys(data as object) },
      );

      return data as T;
    } catch (error) {
      // RN's fetch polyfill throws `Error: Aborted`, not a DOMException named
      // 'AbortError', so an expected abort is recognised by the caller's signal.
      // Re-thrown either way; callers gate on `signal?.aborted`.
      if (!signal?.aborted) {
        logger.error('Spoonacular API request failed:', error);
      }
      throw error;
    }
  }

  /** https://spoonacular.com/food-api/docs#Search-Recipes-by-Ingredients */
  async searchRecipesByIngredients(
    params: SearchRecipesByIngredientsParams,
    signal?: AbortSignal,
  ): Promise<RecipeSearchResult[]> {
    const {
      ingredients,
      number = 10,
      ranking = 1,
      ignorePantry = true,
    } = params;

    return this.fetch<RecipeSearchResult[]>(
      '/recipes/findByIngredients',
      {
        ingredients,
        number: Math.min(number, 100),
        ranking,
        ignorePantry,
      },
      signal,
    );
  }

  /** https://spoonacular.com/food-api/docs#Get-Recipe-Information */
  async getRecipeInformation(
    params: GetRecipeInformationParams,
    signal?: AbortSignal,
  ): Promise<RecipeInformation> {
    const { id, includeNutrition = true } = params;

    return this.fetch<RecipeInformation>(
      `/recipes/${id}/information`,
      {
        includeNutrition,
      },
      signal,
    );
  }

  /**
   * Complex search, basic results only — for full details per result use
   * `searchRecipesWithInfo`.
   * https://spoonacular.com/food-api/docs#Search-Recipes-Complex
   */
  async searchRecipes(
    params: SearchRecipesParamsWithoutInfo,
    signal?: AbortSignal,
  ): Promise<SearchRecipesResponse> {
    return this.complexSearch<SearchRecipesResponse>(params, signal);
  }

  /** Sends `addRecipeInformation=true`, so `results[]` holds RecipeInformation. */
  async searchRecipesWithInfo(
    params: SearchRecipesParamsWithoutInfo,
    signal?: AbortSignal,
  ): Promise<SearchRecipesResponseWithInfo> {
    return this.complexSearch<SearchRecipesResponseWithInfo>(
      { ...params, addRecipeInformation: true } as SearchRecipesParamsWithInfo,
      signal,
    );
  }

  private async complexSearch<R>(
    params: SearchRecipesParams,
    signal?: AbortSignal,
  ): Promise<R> {
    const { query, number = 10, offset = 0, ...restParams } = params;
    return this.fetch<R>(
      '/recipes/complexSearch',
      {
        query,
        number: Math.min(number, 100),
        offset,
        ...restParams,
      },
      signal,
    );
  }

  /** https://spoonacular.com/food-api/docs#Get-Random-Recipes */
  async getRandomRecipes(
    params: GetRandomRecipesParams = {},
    signal?: AbortSignal,
  ): Promise<RecipeInformation[]> {
    const { number = 10, tags, includeNutrition = false } = params;

    const response = await this.fetch<GetRandomRecipesResponse>(
      '/recipes/random',
      {
        number: Math.min(number, 100), // Spoonacular API max is 100
        'include-tags': tags,
        includeNutrition,
      },
      signal,
    );

    return response.recipes;
  }

  /** One HTTP call, but still charged one quota request per recipe id. */
  async getBulkRecipeInformation(
    ids: number[],
    signal?: AbortSignal,
  ): Promise<RecipeInformation[]> {
    const idsString = ids.join(',');

    return this.fetch<RecipeInformation[]>(
      '/recipes/informationBulk',
      {
        ids: idsString,
      },
      signal,
    );
  }

  /**
   * Per-ingredient estimated cost + totals; `price` fields are in US cents. The
   * `.json` widget variant returns raw data instead of HTML.
   * https://spoonacular.com/food-api/docs#Price-Breakdown-by-ID
   */
  async getRecipePriceBreakdown(
    id: number,
    signal?: AbortSignal,
  ): Promise<RecipePriceBreakdown> {
    return this.fetch<RecipePriceBreakdown>(
      `/recipes/${id}/priceBreakdownWidget.json`,
      {},
      signal,
    );
  }

  /**
   * Get current request count (for debugging/monitoring)
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Reset request count (e.g., at midnight)
   */
  resetRequestCount(): void {
    this.requestCount = 0;
    logger.debug('Spoonacular request count reset');
  }

  /**
   * Get remaining requests for the day
   */
  getRemainingRequests(): number {
    return Math.max(0, this.dailyLimit - this.requestCount);
  }
}

// Export singleton instance
export const spoonacularService = new SpoonacularService();
