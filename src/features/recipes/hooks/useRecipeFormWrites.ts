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
} from '#features/recipes/graphql/recipe.generated';
import {
  UseRecipeFormWrites_RecipeFragmentDoc,
  type UseRecipeFormWrites_RecipeFragment,
} from './useRecipeFormWrites.generated';
import type {
  CreateRecipeInput,
  UpdateRecipeInput,
} from '#/graphql/generated/schemaTypes';
import type { CreateRecipeInputs } from '#features/recipes/offline/localWrites';
import type { RecipeCreatedBy } from '#features/recipes/utils/recipeCacheWriters';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { sendFields } from '#/apollo/pendingWrites/sendFields';
import {
  settleMutation,
  type SettledFailure,
  type SettleOptions,
} from '#/apollo/utils/settleMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import { UnreadVersionError } from '#/apollo/utils/entityWriteChain';
import { useTranslation } from '#/i18n';
import {
  MAX_RECIPE_INGREDIENTS,
  RECIPE_INGREDIENTS_PAGE_SIZE,
} from '#domain/recipeIngredientsPaging';

/**
 * An edit's fields with what the FORM read, against which it is judged, not the
 * cache at save time. `version` is null until the recipe loads;
 * `ingredientsUnread` means the form holds only the first page of ingredients.
 */
export type RecipeUpdateFields = Omit<UpdateRecipeInput, 'id' | 'version'> & {
  version: number | null;
  ingredientsUnread: boolean;
};

/** A refused save, as the form shows it: on its field, or as an alert. */
export type RecipeWriteFailure = SettledFailure;

export type RecipeWriteOutcome =
  | { status: 'ok' }
  | { status: 'rejected'; failure: RecipeWriteFailure };

/** The recipe as an edit session loads it. */
type EditableRecipe = UseRecipeFormWrites_RecipeFragment;

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
    recipeId
      ? {
          variables: {
            id: recipeId,
            ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
          },
        }
      : skipToken,
  );
  const recipeRef = recipeData?.recipe ?? null;

  /**
   * Materialize the masked ref into the form's own narrow fragment. A callback
   * rather than `useFragment` so the caller can run it from an effect, where a
   * hook cannot go.
   */
  const readRecipe = (): EditableRecipe | null =>
    recipeRef
      ? client.cache.readFragment<EditableRecipe>({
          fragment: UseRecipeFormWrites_RecipeFragmentDoc,
          fragmentName: 'useRecipeFormWrites_recipe',
          from: recipeRef,
          optimistic: true,
        })
      : null;

  const [createRecipeMutation, { loading: creating }] = useMutation(
    CreateRecipeDocument,
    { context: { localFirst: true } },
  );
  const [updateRecipeMutation, { loading: updating }] = useMutation(
    UpdateRecipeDocument,
    { context: { localFirst: true } },
  );

  /** The minted cuid is the row's real PK, so a queued create replays onto it. */
  const createRecipe = async (
    input: Omit<CreateRecipeInput, 'id'>,
    createdBy: RecipeCreatedBy,
  ): Promise<RecipeWriteOutcome> => {
    const recipe = { ...input, id: generateEntityId() };
    const inputs: CreateRecipeInputs = {
      id: recipe.id,
      recipe,
      createdBy,
      ingredientIds: input.ingredients.map(() => generateEntityId()),
    };

    const settled = await pendingWritesOf(client.cache).send(
      CreateRecipeDocument,
      { input: recipe },
      write =>
        settleMutation(() => createRecipeMutation(write), {
          document: CreateRecipeDocument,
          fallback: t('recipes.createRecipeFailed'),
          // The form shows the failure, on its field where it names one.
          present: 'none',
        }),
      inputs,
    );
    return outcomeOf(settled.failure);
  };

  /**
   * The fields and the ingredient list in one write under the version: both
   * land or neither does. The list REPLACES the recipe's, so the form of a
   * recipe over the ingredient limit, which holds part of it, sends nothing.
   */
  const updateRecipe = async (
    id: string,
    { version, ingredientsUnread, ...fields }: RecipeUpdateFields,
  ): Promise<RecipeWriteOutcome> => {
    if (ingredientsUnread) {
      return outcomeOf({
        code: null,
        field: null,
        title: t('labels.error'),
        body: t('recipes.editIngredientsOverLimit', {
          count: MAX_RECIPE_INGREDIENTS,
        }),
      });
    }
    const settle: SettleOptions = {
      document: UpdateRecipeDocument,
      fallback: t('recipes.updateRecipeFailed'),
      present: 'none',
    };
    const settled =
      version === null
        ? await settleMutation(
            () => Promise.reject(new UnreadVersionError('Recipe')),
            settle,
          )
        : await sendFields(client.cache, {
            entity: { __typename: 'Recipe', id },
            // The device shows the edit once the server has it.
            fields: {},
            variables: {
              input: { ...fields, id, version },
              ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
            },
            mutate: updateRecipeMutation,
            settle,
          });
    return outcomeOf(settled.failure);
  };

  /**
   * The recipe as the server now has it, for a form reopening after a conflict;
   * null when it could not be re-read, since the cache still holds the copy the
   * save was refused against.
   */
  const reloadRecipe = async (): Promise<EditableRecipe | null> => {
    const refreshed = await refetchRecipe().catch(() => null);
    return refreshed && !refreshed.error ? readRecipe() : null;
  };

  return {
    recipeRef,
    readRecipe,
    reloadRecipe,
    createRecipe,
    updateRecipe,
    saving: creating || updating,
  };
}
