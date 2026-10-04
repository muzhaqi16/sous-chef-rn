import { localizedErrorMessage } from '#/services/errorService';
import { useTranslation } from '#/i18n';
import { skipToken, useFragment, useQuery } from '@apollo/client/react';
import { GetRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import {
  UseRecipeData_RecipeFragmentDoc,
  type UseRecipeData_RecipeFragment,
} from './useRecipeData.generated';
import { extractNodes } from '#/utils/connectionUtils';
import { knownEntry } from '#/utils/closedEnum';
import {
  ExternalSyncStatus,
  RecipeRevisionStatus,
  type RecipeStatus,
} from '#/graphql/generated/schemaTypes';
import type { CatalogRecipeHint } from './useOpenCatalogRecipe';
import type { DataAttributionValue } from '#components/molecules/DataAttributionNotices';

export type MaterializedRecipe = UseRecipeData_RecipeFragment;

export type DisplayIngredient = NonNullable<
  MaterializedRecipe['ingredientsConnection']['edges'][number]['node']
>;

/**
 * How much of a recipe there is to show. A catalog recipe the API has not
 * fetched carries only its name and image: `pending` until a save brings the
 * rest in, `unavailable` when its provider does not have it.
 */
export type RecipeDetails = 'complete' | 'opening' | 'pending' | 'unavailable';

const DETAILS_BY_SYNC_STATUS: Record<ExternalSyncStatus, RecipeDetails> = {
  [ExternalSyncStatus.Synced]: 'complete',
  [ExternalSyncStatus.ClientSupplied]: 'complete',
  [ExternalSyncStatus.Pending]: 'pending',
  [ExternalSyncStatus.NotFound]: 'unavailable',
};

export interface RecipeDisplayData {
  title: string;
  image?: string;
  servings?: number;
  readyInMinutes?: number;
  healthScore?: number;
  summary?: string;
  ingredients: DisplayIngredient[];
  instructions?: MaterializedRecipe['instructions'];
  vegetarian?: boolean;
  vegan?: boolean;
  glutenFree?: boolean;
  dairyFree?: boolean;
  sourceName?: string;
  sourceUrl?: string;
  /** The provider's notices, shown beside the recipe; empty for an in-app one. */
  dataAttributions: readonly DataAttributionValue[];
  caloriesPerServing?: number;
  nutritionData?: unknown;
  status?: RecipeStatus;
  /** A moderator's note on the last decision; the author's own recipes only. */
  reviewNote?: string;
  /** The author's edit to a published recipe is waiting for review. */
  hasPendingRevision: boolean;
  /** Why the author's last edit to a published recipe was rejected. */
  revisionRejectionNote?: string;
  publishedAt?: string;
  forkedFromId?: string;
  forkedFromName?: string;
  originalAuthor?: string;
  tips?: string;
  videoUrl?: string;
  tags?: string[];
  details: RecipeDetails;
}

export interface UseRecipeDataParams {
  recipeId: string | undefined;
  /** What the list row showed, shown while a catalog recipe is being opened. */
  hint: CatalogRecipeHint | undefined;
  /** Localized: why a catalog recipe could not be opened. */
  openFailure: string | null;
}

export interface UseRecipeDataResult {
  displayData: RecipeDisplayData | null;
  loading: boolean;
  /** Localized: why there is no recipe to show. */
  error: string | null;
  backendRecipe: MaterializedRecipe | undefined;
  /** Settles when the recipe has been read again, so a pull can wait on it. */
  refetch: () => Promise<unknown>;
}

function buildDisplayData(recipe: MaterializedRecipe): RecipeDisplayData {
  const provider = recipe.externalDetails;
  const syncStatus = recipe.sourceMapping?.syncStatus;
  return {
    title: recipe.name,
    image: recipe.imageUrl ?? undefined,
    servings: recipe.servings,
    readyInMinutes: recipe.totalTimeMinutes ?? undefined,
    healthScore: provider?.healthScore ?? undefined,
    summary: recipe.description ?? undefined,
    ingredients: extractNodes(recipe.ingredientsConnection),
    instructions: recipe.instructions,
    vegetarian: provider?.vegetarian ?? undefined,
    vegan: provider?.vegan ?? undefined,
    glutenFree: provider?.glutenFree ?? undefined,
    dairyFree: provider?.dairyFree ?? undefined,
    sourceName: recipe.source ?? undefined,
    sourceUrl: recipe.sourceUrl ?? undefined,
    dataAttributions: recipe.dataAttributions,
    caloriesPerServing: recipe.caloriesPerServing ?? undefined,
    nutritionData: recipe.nutritionData ?? undefined,
    status: recipe.status,
    reviewNote: recipe.reviewNote ?? undefined,
    hasPendingRevision: !!recipe.pendingRevision,
    revisionRejectionNote:
      recipe.latestRevision?.status === RecipeRevisionStatus.Rejected
        ? recipe.latestRevision.reviewNote ?? undefined
        : undefined,
    publishedAt: recipe.publishedAt ?? undefined,
    forkedFromId: recipe.forkedFromId ?? undefined,
    forkedFromName: recipe.forkedFrom?.name ?? undefined,
    originalAuthor: recipe.originalAuthor ?? undefined,
    tips: recipe.tips ?? undefined,
    videoUrl: recipe.videoUrl ?? undefined,
    tags: recipe.tags,
    // A status newer than this build shows what the recipe carries.
    details: syncStatus
      ? knownEntry(DETAILS_BY_SYNC_STATUS, syncStatus) ?? 'complete'
      : 'complete',
  };
}

/**
 * The recipe the screen shows, always the API's `Recipe`. A catalog recipe
 * still being opened shows the row's name and image until its id arrives.
 */
export function useRecipeData({
  recipeId,
  hint,
  openFailure,
}: UseRecipeDataParams): UseRecipeDataResult {
  const { t } = useTranslation();
  const { data, loading, error, refetch, variables } = useQuery(
    GetRecipeDocument,
    recipeId ? { variables: { id: recipeId } } : skipToken,
  );
  // `skipToken` keeps the last run's variables, data and error: a result for
  // another recipe is not this one's.
  const current = !!recipeId && variables.id === recipeId;

  // Live: a save changes only fields behind the query's mask, which leaves
  // `data.recipe` the same object.
  const recipe = useFragment({
    fragment: UseRecipeData_RecipeFragmentDoc,
    fragmentName: 'useRecipeData_recipe',
    from: current ? data?.recipe ?? null : null,
  });
  const backendRecipe = recipe.complete ? recipe.data : undefined;

  const opening = !recipeId && !!hint && !openFailure;

  const displayData: RecipeDisplayData | null = backendRecipe
    ? buildDisplayData(backendRecipe)
    : opening && hint.name
    ? {
        title: hint.name,
        image: hint.imageUrl,
        ingredients: [],
        dataAttributions: [],
        hasPendingRevision: false,
        details: 'opening',
      }
    : null;

  const resolveError = () => {
    if (openFailure) return openFailure;
    if (current && error) {
      return localizedErrorMessage(error, t('recipes.loadFailed'));
    }
    if (!recipeId && !hint) return t('recipes.recipeNotFound');
    return null;
  };

  return {
    displayData,
    loading: opening || loading,
    error: resolveError(),
    backendRecipe,
    refetch: () => (recipeId ? refetch() : Promise.resolve()),
  };
}
