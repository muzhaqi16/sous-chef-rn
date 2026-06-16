import { useState, useEffect } from 'react';
import { errorService } from '#/services/errorService';
import { useApolloClient, useQuery } from '@apollo/client/react';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import type {
  RecipeInformation,
  RecipeIngredient as ExternalRecipeIngredient,
  RecipeInstruction as ExternalRecipeInstruction,
} from '#/services/recipeApi/types';
import { GetRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import type {
  GetRecipeQuery,
  GetRecipeQueryVariables,
} from '#features/recipes/graphql/recipe.generated';
import {
  UseRecipeData_RecipeFragmentDoc,
  type UseRecipeData_RecipeFragment,
} from './useRecipeData.generated';

export type MaterializedRecipe = NonNullable<
  ReturnType<typeof readRecipeFragment>
>;

/** Backend recipe ingredient (from the GraphQL RecipeFragment). */
type BackendRecipeIngredient = MaterializedRecipe['ingredients'][number];

/**
 * Normalized display ingredient: either a backend `RecipeIngredient` or an
 * external Spoonacular `extendedIngredient`. Consumers read the fields that
 * exist on whichever source produced `displayData`.
 */
export type DisplayIngredient =
  | BackendRecipeIngredient
  | ExternalRecipeIngredient;

/** Backend `instructions` is a schema `JSON` scalar; external is a step list. */
export type DisplayInstructions =
  | MaterializedRecipe['instructions']
  | ExternalRecipeInstruction[];

function readRecipeFragment(
  client: ReturnType<typeof useApolloClient>,
  ref: NonNullable<GetRecipeQuery['recipe']> | null,
) {
  if (!ref) return null;
  return client.cache.readFragment<UseRecipeData_RecipeFragment>({
    fragment: UseRecipeData_RecipeFragmentDoc,
    fragmentName: 'useRecipeData_recipe',
    from: ref,
  });
}

export interface RecipeDisplayData {
  title: string;
  image?: string;
  servings?: number;
  readyInMinutes?: number;
  healthScore?: number;
  summary?: string;
  ingredients: DisplayIngredient[];
  instructions?: DisplayInstructions;
  instructionsHtml?: string;
  vegetarian?: boolean;
  vegan?: boolean;
  glutenFree?: boolean;
  dairyFree?: boolean;
  sourceName?: string;
  sourceUrl?: string;
}

export interface UseRecipeDataParams {
  recipeId: string | undefined;
  externalSource: string | undefined;
  externalId: string | undefined;
  /** Fire-and-forget preload — when an external recipe loads, send it to the
   *  backend so the next visit can use the backend recipe instead. */
  preloadRecipe: (recipe: RecipeInformation) => Promise<unknown>;
}

export interface UseRecipeDataResult {
  displayData: RecipeDisplayData | null;
  loading: boolean;
  error: string | null;
  backendError: ReturnType<
    typeof useQuery<GetRecipeQuery, GetRecipeQueryVariables>
  >['error'];
  backendRecipe: MaterializedRecipe | undefined;
  isBackendRecipe: boolean;
  externalRecipe: RecipeInformation | null;
}

/** Module-level helper: handles recipe loading with loading/error state management.
 *  Extracted from the hook body to avoid React Compiler bailout from try-catch-finally. */
async function fetchRecipeData(
  params: {
    recipeId: string | undefined;
    externalSource: string | undefined;
    externalId: string | undefined;
    backendLoading: boolean;
  },
  signal: AbortSignal,
  setExternalRecipe: (recipe: RecipeInformation) => void,
  setError: (error: string | null) => void,
  setLoading: (loading: boolean) => void,
  preloadRecipe: (recipe: RecipeInformation) => Promise<unknown>,
): Promise<void> {
  if (params.recipeId) {
    setLoading(params.backendLoading);
    return;
  }

  if (!params.externalSource || !params.externalId) {
    setError('Recipe not available.');
    setLoading(false);
    return;
  }

  try {
    setLoading(true);
    setError(null);

    if (params.externalSource === 'SPOONACULAR') {
      const data = await spoonacularService.getRecipeInformation(
        {
          id: Number(params.externalId),
          includeNutrition: true,
        },
        signal,
      );
      setExternalRecipe(data);

      preloadRecipe(data).catch(() => {
        // Ignore errors - fire and forget
      });
    } else {
      throw new Error(`Unsupported external source: ${params.externalSource}`);
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return;
    errorService.reportError(err, { operation: 'fetchRecipe' });
    setError('Failed to load recipe. Please try again.');
  } finally {
    setLoading(false);
  }
}

function buildBackendDisplayData(
  recipe: MaterializedRecipe,
): RecipeDisplayData {
  return {
    title: recipe.name,
    image: recipe.imageUrl ?? undefined,
    servings: recipe.servings,
    readyInMinutes: recipe.totalTimeMinutes ?? undefined,
    summary: recipe.description ?? undefined,
    ingredients: recipe.ingredients || [],
    instructions: recipe.instructions,
    sourceName: recipe.source ?? undefined,
    sourceUrl: recipe.sourceUrl ?? undefined,
  };
}

function buildExternalDisplayData(
  recipe: RecipeInformation,
): RecipeDisplayData {
  return {
    title: recipe.title,
    image: recipe.image,
    servings: recipe.servings,
    readyInMinutes: recipe.readyInMinutes,
    healthScore: recipe.healthScore,
    summary: recipe.summary,
    ingredients: recipe.extendedIngredients || [],
    instructions: recipe.analyzedInstructions,
    instructionsHtml: recipe.instructions,
    vegetarian: recipe.vegetarian,
    vegan: recipe.vegan,
    glutenFree: recipe.glutenFree,
    dairyFree: recipe.dairyFree,
    sourceName: recipe.sourceName,
    sourceUrl: recipe.sourceUrl,
  };
}

/**
 * Loads a recipe from either the backend (`recipeId`) or an external source
 * (`externalSource` + `externalId`) and returns a normalized `displayData`
 * shape. Backend recipes preempt external ones; an external load also
 * fire-and-forget preloads the recipe to the backend so the next visit hits
 * the cached backend copy.
 */
export function useRecipeData({
  recipeId,
  externalSource,
  externalId,
  preloadRecipe,
}: UseRecipeDataParams): UseRecipeDataResult {
  const [loading, setLoading] = useState(true);
  const [externalRecipe, setExternalRecipe] =
    useState<RecipeInformation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apolloClient = useApolloClient();
  const {
    data: backendRecipeData,
    loading: backendLoading,
    error: backendError,
  } = useQuery(GetRecipeDocument, {
    variables: { id: recipeId ?? '' },
    skip: !recipeId,
    fetchPolicy: 'cache-and-network',
  });

  // Materialize the masked RecipeFragment ref so downstream consumers (and
  // this hook's own buildBackendDisplayData) see the full RecipeFragment
  // fields.
  const backendRecipeRef = backendRecipeData?.recipe ?? null;
  const backendRecipe =
    readRecipeFragment(apolloClient, backendRecipeRef) ?? undefined;

  useEffect(() => {
    const controller = new AbortController();

    fetchRecipeData(
      { recipeId, externalSource, externalId, backendLoading },
      controller.signal,
      setExternalRecipe,
      setError,
      setLoading,
      preloadRecipe,
    );

    return () => controller.abort();
  }, [externalSource, externalId, recipeId, backendLoading, preloadRecipe]);

  const isBackendRecipe = !!recipeId && !!backendRecipe;

  const displayData: RecipeDisplayData | null = (() => {
    if (isBackendRecipe && backendRecipe) {
      return buildBackendDisplayData(backendRecipe);
    }
    if (externalRecipe) {
      return buildExternalDisplayData(externalRecipe);
    }
    return null;
  })();

  return {
    displayData,
    loading: loading || backendLoading,
    error,
    backendError,
    backendRecipe,
    isBackendRecipe,
    externalRecipe,
  };
}
