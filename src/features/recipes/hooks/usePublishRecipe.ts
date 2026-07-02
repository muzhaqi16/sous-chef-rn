/**
 * usePublishRecipe — publish / unpublish a recipe via updateRecipe(status).
 *
 * There's no dedicated publish mutation: publishing sets `status` to PUBLISHED
 * (DRAFT to unpublish). It's an absolute status set keyed by the recipe id, so
 * it's local-first (a queued replay re-applies the same state idempotently). The
 * UpdateRecipe response carries `status`/`isPublished`/`publishedAt`, so the
 * detail screen reflects the new state once it lands.
 */

import { useMutation } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import { UpdateRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { RecipeStatus } from '#/graphql/generated/schemaTypes';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { executeMutation } from '#/utils/compilerSafeWrappers';

export function usePublishRecipe() {
  const { t } = useTranslation();
  const [mutate, { loading: publishing }] = useMutation(UpdateRecipeDocument);

  const setPublished = async (
    recipeId: string,
    published: boolean,
  ): Promise<boolean> => {
    const result = await executeMutation(
      () =>
        mutate({
          variables: {
            input: {
              id: recipeId,
              status: published ? RecipeStatus.Published : RecipeStatus.Draft,
            },
          },
          context: { localFirst: true },
        }),
      'Publish Recipe error:',
    );
    if (!result) return false;
    return !alertIfRejected(
      result,
      'updateRecipe',
      'UpdateRecipePayload',
      t('recipes.publishFailed'),
    );
  };

  return { setPublished, publishing };
}
