import {
  skipToken,
  useApolloClient,
  useMutation,
  useQuery,
} from '@apollo/client/react';
import {
  GetRecipeDocument,
  CreateRecipeDocument,
  UpdateRecipeDocument,
  UpdateRecipeIngredientsDocument,
} from '#features/recipes/graphql/recipe.generated';
import {
  RecipeForm_RecipeFragmentDoc,
  type RecipeForm_RecipeFragment,
} from '#features/recipes/screens/RecipeForm/RecipeForm.generated';
import type {
  CreateRecipeInput,
  UpdateRecipeInput,
  RecipeIngredientInput,
} from '#/graphql/generated/schemaTypes';
import {
  upsertMyRecipesEdge,
  writeLocalRecipe,
  revertOptimisticRecipe,
  type RecipeCreatedBy,
} from '#features/recipes/utils/recipeCacheWriters';
import {
  settleMutation,
  type SettledFailure,
} from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';

/** A refused save, as the form shows it: on its field, or as an alert. */
export type RecipeWriteFailure = SettledFailure;

export type RecipeWriteOutcome =
  | { status: 'ok' }
  | { status: 'rejected'; failure: RecipeWriteFailure };

const outcomeOf = (
  failure: RecipeWriteFailure | undefined,
): RecipeWriteOutcome =>
  failure ? { status: 'rejected', failure } : { status: 'ok' };

/** The recipe an edit session loads, and the writes the form makes. */
export function useRecipeFormWrites(recipeId: string | undefined) {
  const client = useApolloClient();
  const { t } = useTranslation();

  const { data: recipeData, refetch: refetchRecipe } = useQuery(
    GetRecipeDocument,
    recipeId ? { variables: { id: recipeId } } : skipToken,
  );
  const recipeRef = recipeData?.recipe ?? null;

  /**
   * Materialize the masked ref into the form's own narrow fragment. A callback
   * rather than `useFragment` so the caller can run it from an effect, where a
   * hook cannot go.
   */
  const readRecipe = (): RecipeForm_RecipeFragment | null =>
    recipeRef
      ? client.cache.readFragment<RecipeForm_RecipeFragment>({
          fragment: RecipeForm_RecipeFragmentDoc,
          fragmentName: 'RecipeForm_recipe',
          from: recipeRef,
        })
      : null;

  const [createRecipeMutation, { loading: creating }] = useMutation(
    CreateRecipeDocument,
    {
      context: { localFirst: true },
      update: (cache, { data }) => {
        const payload = appliedPayload(data);
        if (!payload) return;
        // Upsert: the local-first pre-fire write already inserted the edge
        // under the same client-minted id — the server row replaces it.
        upsertMyRecipesEdge(cache, payload.recipe);
      },
    },
  );
  const [updateRecipeMutation, { loading: updating }] = useMutation(
    UpdateRecipeDocument,
    { context: { localFirst: true } },
  );
  const [updateRecipeIngredientsMutation, { loading: updatingIngredients }] =
    useMutation(UpdateRecipeIngredientsDocument, {
      context: { localFirst: true },
    });

  /**
   * Mint the permanent cuid (the row's real PK) and write the recipe into My
   * Recipes plus the full detail entity before firing, so creating works fully
   * offline — the queued create replays keyed by that same id.
   */
  const createRecipe = async (
    input: Omit<CreateRecipeInput, 'id'>,
    createdBy: RecipeCreatedBy,
  ): Promise<RecipeWriteOutcome> => {
    const id = generateEntityId();
    try {
      writeLocalRecipe(client.cache, id, input, createdBy);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Create Recipe (optimistic)',
      });
    }

    const revertRecipe = () => {
      try {
        revertOptimisticRecipe(client.cache, id);
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Revert rejected Recipe create',
        });
      }
    };

    // Online success or queued offline — the recipe is in My Recipes either way.
    const settled = await settleMutation(
      () =>
        createRecipeMutation({
          variables: { input: { ...input, id } },
        }),
      {
        document: CreateRecipeDocument,
        fallback: t('recipes.createRecipeFailed'),
        onFailed: revertRecipe,
        // The form shows the failure, on its field where it names one.
        present: 'none',
      },
    );
    return outcomeOf(settled.failure);
  };

  /**
   * The ingredients follow the fields, never beside them: the fields carry the
   * version, so a save refused as changed elsewhere writes nothing. Offline
   * both queue at once and replay in FIFO order against the same recipe id.
   */
  const updateRecipe = async (
    id: string,
    input: Omit<UpdateRecipeInput, 'id'>,
    ingredients: RecipeIngredientInput[],
  ): Promise<RecipeWriteOutcome> => {
    const fallback = t('recipes.updateRecipeFailed');
    const recipeLeg = await settleMutation(
      () =>
        updateRecipeMutation({
          variables: { input: { ...input, id } },
        }),
      { document: UpdateRecipeDocument, fallback, present: 'none' },
    );
    if (recipeLeg.failure) return outcomeOf(recipeLeg.failure);

    const ingredientsLeg = await settleMutation(
      () =>
        updateRecipeIngredientsMutation({
          variables: { input: { recipeId: id, ingredients } },
        }),
      {
        document: UpdateRecipeIngredientsDocument,
        fallback,
        present: 'none',
      },
    );
    return outcomeOf(ingredientsLeg.failure);
  };

  /** The recipe as the server now has it, for a form reopening after a conflict. */
  const reloadRecipe = async (): Promise<RecipeForm_RecipeFragment | null> => {
    await refetchRecipe();
    return readRecipe();
  };

  return {
    recipeRef,
    readRecipe,
    reloadRecipe,
    createRecipe,
    updateRecipe,
    saving: creating || updating || updatingIngredients,
  };
}
