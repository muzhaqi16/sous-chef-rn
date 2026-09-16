/**
 * Publish / unpublish via `updateRecipe(status)` — an absolute status set keyed
 * by the recipe id, so local-first and idempotent on replay. The toggle reads
 * `Recipe.isPublished`, so the flip is written BEFORE firing; a failure
 * reverts from a snapshot, a queued write keeps it.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { UpdateRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { RecipeStatus } from '#/graphql/generated/schemaTypes';
import { settleMutation } from '#/apollo/utils/settleMutation';

export function usePublishRecipe() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [mutate, { loading: publishing }] = useMutation(UpdateRecipeDocument);

  const setPublished = async (
    recipeId: string,
    published: boolean,
  ): Promise<boolean> => {
    // Flip the cached `isPublished` the detail screen reads before firing.
    // `cache.modify` only runs the modifier when the field is already cached,
    // so `didWrite` gates the revert to that case (no-op on the detail screen's
    // first render before the recipe is cached, or in unit tests).
    const cacheId = client.cache.identify({
      __typename: 'Recipe',
      id: recipeId,
    });
    let previousIsPublished: boolean | undefined;
    let didWrite = false;
    if (cacheId) {
      client.cache.modify<{ isPublished: boolean }>({
        id: cacheId,
        fields: {
          isPublished(existing) {
            previousIsPublished = existing;
            didWrite = true;
            return published;
          },
        },
      });
    }
    const revert = () => {
      if (cacheId && didWrite) {
        client.cache.modify<{ isPublished: boolean }>({
          id: cacheId,
          fields: { isPublished: () => previousIsPublished ?? false },
        });
      }
    };

    const status = published ? RecipeStatus.Published : RecipeStatus.Draft;
    const settled = await settleMutation(
      () =>
        mutate({
          variables: { input: { id: recipeId, status } },
          context: { localFirst: true },
        }),
      {
        document: UpdateRecipeDocument,
        fallback: t('labels.failedToUpdateRecipe'),
        onFailed: revert,
      },
    );
    return settled.status !== 'failed';
  };

  return { setPublished, publishing };
}
