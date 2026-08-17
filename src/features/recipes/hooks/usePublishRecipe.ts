/**
 * usePublishRecipe — publish / unpublish a recipe via updateRecipe(status).
 *
 * There's no dedicated publish mutation: publishing sets `status` to PUBLISHED
 * (DRAFT to unpublish). It's an absolute status set keyed by the recipe id, so
 * it's local-first (a queued replay re-applies the same state idempotently).
 *
 * The detail screen's publish toggle reads `Recipe.isPublished` from the cache,
 * so the flip is written optimistically BEFORE firing — the toggle reflects the
 * change immediately, including offline where the queued update only reconciles
 * on replay. A resolved rejection reverts from a snapshot; a queued (null)
 * result keeps the optimistic flip and replays.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { UpdateRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { RecipeStatus } from '#/graphql/generated/schemaTypes';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { errorService } from '#/services/errorService';

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

    // Resolved before the try — a ternary inside a try body makes the React
    // Compiler bail out of this hook.
    const status = published ? RecipeStatus.Published : RecipeStatus.Draft;
    let result;
    try {
      result = await mutate({
        variables: { input: { id: recipeId, status } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Publish Recipe error:',
      });
    }
    if (!result) {
      revert(); // threw before resolving
      return false;
    }

    // A resolved rejection reverts the optimistic flip; a queued (null) result
    // keeps it — the update replays idempotently on reconnect.
    const rejected = alertIfRejected(result, t('recipes.publishFailed'));
    if (rejected) revert();
    return !rejected;
  };

  return { setPublished, publishing };
}
