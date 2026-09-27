/**
 * Submit for review, withdraw, or unpublish via `updateRecipe(status)` — an
 * absolute status set keyed by the recipe id, so local-first and idempotent on
 * replay. Submitting lands in PENDING_REVIEW until a moderator approves, never
 * straight in PUBLISHED, so that is what the cache shows before firing; a
 * failure reverts from a snapshot, a queued write keeps it.
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

  /** `true` submits the recipe for review; `false` returns it to a draft. */
  const setSubmitted = async (
    recipeId: string,
    submitted: boolean,
  ): Promise<boolean> => {
    // `cache.modify` only runs a modifier when the field is already cached, so
    // `didWrite` gates the revert to that case.
    const cacheId = client.cache.identify({
      __typename: 'Recipe',
      id: recipeId,
    });
    let previous: { status: RecipeStatus; isPublished: boolean } | undefined;
    if (cacheId) {
      client.cache.modify<{ status: RecipeStatus; isPublished: boolean }>({
        id: cacheId,
        fields: {
          status(existing, { readField }) {
            previous = {
              status: existing,
              isPublished: readField<boolean>('isPublished') ?? false,
            };
            return submitted ? RecipeStatus.PendingReview : RecipeStatus.Draft;
          },
          isPublished: () => false,
        },
      });
    }
    const revert = () => {
      const snapshot = previous;
      if (cacheId && snapshot) {
        client.cache.modify<{ status: RecipeStatus; isPublished: boolean }>({
          id: cacheId,
          fields: {
            status: () => snapshot.status,
            isPublished: () => snapshot.isPublished,
          },
        });
      }
    };

    const status = submitted ? RecipeStatus.Published : RecipeStatus.Draft;
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

  return { setSubmitted, publishing };
}
