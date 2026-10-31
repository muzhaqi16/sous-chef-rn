/**
 * Submit, withdraw or unpublish via `updateRecipe(status)`, an absolute set, so
 * idempotent on replay. Submitting lands in PENDING_REVIEW until a moderator
 * approves, which the device shows until the server answers.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { UpdateRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { RecipeStatus } from '#/graphql/generated/schemaTypes';
import { RECIPE_INGREDIENTS_PAGE_SIZE } from '#domain/recipeIngredientsPaging';
import { sendFields } from '#/apollo/pendingWrites/sendFields';
import { readVersion } from '#/apollo/utils/entityWriteChain';
import { alertService } from '#/services/alertService';

export function usePublishRecipe() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [mutate, { loading: publishing }] = useMutation(UpdateRecipeDocument, {
    context: { localFirst: true },
  });

  /** `true` submits the recipe for review; `false` returns it to a draft. */
  const setSubmitted = async (
    recipeId: string,
    submitted: boolean,
  ): Promise<boolean> => {
    const entity = { __typename: 'Recipe', id: recipeId };
    const version = readVersion(client.cache, entity);
    if (version === undefined) {
      alertService.alert(t('labels.error'), t('labels.failedToUpdateRecipe'));
      return false;
    }

    const status = submitted ? RecipeStatus.Published : RecipeStatus.Draft;
    const settled = await sendFields(client.cache, {
      entity,
      fields: {
        status: submitted ? RecipeStatus.PendingReview : RecipeStatus.Draft,
        isPublished: false,
      },
      variables: {
        input: { id: recipeId, status, version },
        ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
      },
      mutate,
      settle: {
        document: UpdateRecipeDocument,
        fallback: t('labels.failedToUpdateRecipe'),
      },
    });
    return settled.status !== 'failed';
  };

  return { setSubmitted, publishing };
}
