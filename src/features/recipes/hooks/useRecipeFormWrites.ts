import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
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
  writeOptimisticRecipe,
  revertOptimisticRecipe,
  type RecipeCreatedBy,
} from '#features/recipes/utils/recipeCacheWriters';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { generateEntityId } from '#/utils/generateEntityId';
import { errorService } from '#/services/errorService';

/** The refusal payload is carried so the caller can resolve LOCALIZED copy. */
export interface RecipeWriteOutcome {
  status: 'ok' | 'rejected';
  payload: RefusalPayload;
}

/** The shape `localizedRefusalMessage` reads, without importing presentation. */
type RefusalPayload =
  | { __typename?: string; code?: string | null; field?: string | null }
  | null
  | undefined;

/** The recipe an edit session loads, and the writes the form makes. */
export function useRecipeFormWrites(recipeId: string | undefined) {
  const client = useApolloClient();

  const { data: recipeData } = useQuery(GetRecipeDocument, {
    variables: { id: recipeId! },
    skip: !recipeId,
  });
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
      update: (cache, { data }) => {
        if (data?.createRecipe?.__typename !== 'CreateRecipePayload') return;
        // Upsert: the local-first pre-fire write already inserted the edge
        // under the same client-minted id — the server row replaces it.
        upsertMyRecipesEdge(cache, data.createRecipe.recipe);
      },
    },
  );
  const [updateRecipeMutation, { loading: updating }] =
    useMutation(UpdateRecipeDocument);
  const [updateRecipeIngredientsMutation, { loading: updatingIngredients }] =
    useMutation(UpdateRecipeIngredientsDocument);

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
      writeOptimisticRecipe(client.cache, id, input, createdBy);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Create Recipe (optimistic)',
      });
    }

    const result = await createRecipeMutation({
      variables: { input: { ...input, id } },
      context: { localFirst: true },
    });
    // Online success or queued offline — the recipe is in My Recipes either way.
    if (classifyCreateResult(result) !== 'rejected') {
      return { status: 'ok', payload: null };
    }

    try {
      revertOptimisticRecipe(client.cache, id);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Revert rejected Recipe create',
      });
    }
    return { status: 'rejected', payload: result.data?.createRecipe };
  };

  /**
   * Both edits queue together offline and replay in FIFO order against the same
   * recipe id (the queue serializes same-entity ops); the local display catches
   * up when the replay syncs.
   */
  const updateRecipe = async (
    id: string,
    input: Omit<UpdateRecipeInput, 'id'>,
    ingredients: RecipeIngredientInput[],
  ): Promise<RecipeWriteOutcome> => {
    const [updateResult, ingredientsResult] = await Promise.all([
      updateRecipeMutation({
        variables: { input: { ...input, id } },
        context: { localFirst: true },
      }),
      updateRecipeIngredientsMutation({
        variables: { input: { recipeId: id, ingredients } },
        context: { localFirst: true },
      }),
    ]);

    // 'queued' (null payload, no error) counts as success — the edit replays on
    // reconnect.
    const ok =
      classifyCreateResult(updateResult) !== 'rejected' &&
      classifyCreateResult(ingredientsResult) !== 'rejected';
    if (ok) return { status: 'ok', payload: null };

    // The recipe's own refusal names the field; the ingredients' one is the
    // fallback when only that leg was refused.
    return {
      status: 'rejected',
      payload:
        updateResult.data?.updateRecipe ??
        ingredientsResult.data?.updateRecipeIngredients,
    };
  };

  return {
    recipeRef,
    readRecipe,
    createRecipe,
    updateRecipe,
    saving: creating || updating || updatingIngredients,
  };
}
