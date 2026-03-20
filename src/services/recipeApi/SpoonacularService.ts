import Config from 'react-native-config';
import { logger } from '#/utils/environment';
import type {
  SearchRecipesByIngredientsParams,
  RecipeSearchResult,
  GetRecipeInformationParams,
  RecipeInformation,
  SearchRecipesParams,
  SearchRecipesResponse,
  GetRandomRecipesParams,
  GetRandomRecipesResponse,
  SpoonacularApiError,
} from './types';

const BASE_URL = 'https://api.spoonacular.com';

/**
 * Spoonacular API Service
 * Handles all interactions with the Spoonacular API
 *
 * Free tier limits: 150 requests/day
 * Rate limiting: Consider implementing caching and request throttling
 */
class SpoonacularService {
  private apiKey: string;
  private requestCount: number = 0;
  private dailyLimit: number = 150;

  constructor() {
    this.apiKey = Config.SPOONACULAR_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('Spoonacular API key not configured');
    }
  }

  /**
   * Check if we're approaching the daily limit
   */
  private checkRateLimit(): void {
    if (this.requestCount >= this.dailyLimit) {
      logger.warn('Spoonacular daily request limit reached or exceeded');
    } else if (this.requestCount >= this.dailyLimit * 0.9) {
      logger.warn(
        `Approaching Spoonacular daily limit: ${this.requestCount}/${this.dailyLimit}`,
      );
    }
  }

  /**
   * Generic fetch wrapper with error handling
   */
  private async fetch<T>(
    endpoint: string,
    params: Record<string, any> = {},
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

        // Check for rate limiting or quota exceeded
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
      logger.debug('Spoonacular API response:', data);

      return data as T;
    } catch (error) {
      logger.error('Spoonacular API request failed:', error);
      throw error;
    }
  }

  /**
   * Search recipes by ingredients
   * https://spoonacular.com/food-api/docs#Search-Recipes-by-Ingredients
   *
   * @param params - Search parameters
   * @returns Array of recipe search results
   */
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

  /**
   * Get detailed recipe information
   * https://spoonacular.com/food-api/docs#Get-Recipe-Information
   *
   * @param params - Recipe ID and options
   * @returns Detailed recipe information
   */
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
   * Search recipes (complex search)
   * https://spoonacular.com/food-api/docs#Search-Recipes-Complex
   *
   * @param params - Search parameters
   * @returns Search results with pagination
   */
  async searchRecipes(
    params: SearchRecipesParams,
    signal?: AbortSignal,
  ): Promise<SearchRecipesResponse> {
    const { query, number = 10, offset = 0, ...restParams } = params;

    return this.fetch<SearchRecipesResponse>(
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

  /**
   * Get random recipes
   * https://spoonacular.com/food-api/docs#Get-Random-Recipes
   *
   * @param params - Random recipe parameters
   * @returns Array of random recipe information
   */
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

  /**
   * Get multiple recipes information in bulk
   * Useful for batch processing
   *
   * @param ids - Array of recipe IDs
   * @returns Array of recipe information
   */
  async getBulkRecipeInformation(
    ids: number[],
    signal?: AbortSignal,
  ): Promise<RecipeInformation[]> {
    // Note: This is more efficient than individual calls
    // but still counts as 1 request per recipe
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
