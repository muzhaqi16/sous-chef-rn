/**
 * usePublishRecipe — publish / unpublish a recipe via updateRecipe(status).
 *
 * There's no dedicated publish mutation: publishing sets `status` to PUBLISHED
 * (DRAFT to unpublish).
 *
 * Online-only. Publishing is authoring, done with connectivity, so it doesn't
 * pay for offline replay. `isApiUnavailable` is returned so the detail screen
 * can disable the toggle instead of letting it fail; the guard toasts localized
 * copy and reports the hook's normal failure value.
 *
 * The mutation returns the updated `Recipe`, so Apollo normalizes the new
 * `isPublished` by `__typename + id` — no cache callback needed.
 */

import { useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { UpdateRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { RecipeStatus } from '#/graphql/generated/schemaTypes';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { toastService } from '#/services/toastService';
import { errorService } from '#/services/errorService';

export function usePublishRecipe() {
  const { t } = useTranslation();
  const [mutate, { loading: publishing }] = useMutation(UpdateRecipeDocument);
  const isApiUnavailable = useIsApiUnavailable();

  const setPublished = async (
    recipeId: string,
    published: boolean,
  ): Promise<boolean> => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    // Resolved before the try — a ternary inside a try body makes the React
    // Compiler bail out of this hook.
    const status = published ? RecipeStatus.Published : RecipeStatus.Draft;
    let result;
    try {
      result = await mutate({
        variables: { input: { id: recipeId, status } },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Publish Recipe error:',
      });
    }
    if (!result) return false;

    const rejected = alertIfRejected(result, t('labels.failedToUpdateRecipe'));
    return !rejected;
  };

  return { setPublished, publishing, isApiUnavailable };
}
