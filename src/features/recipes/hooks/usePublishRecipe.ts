/**
 * Submit, withdraw or unpublish via `updateRecipe(status)`, an absolute set, so
 * idempotent on replay. Submitting lands in PENDING_REVIEW until a moderator
 * approves, which the cache shows before firing; a failure reverts it.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { UpdateRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { RecipeStatus } from '#/graphql/generated/schemaTypes';
import { RECIPE_INGREDIENTS_PAGE_SIZE } from '#domain/recipeIngredientsPaging';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { chainVersionedWrite } from '#/apollo/utils/entityWriteChain';
import {
  snapshotFields,
  writeEntityFields,
} from '#/apollo/utils/localFirstFields';
import {
  RecipeReadersFragmentDoc,
  type RecipeReadersFragment,
} from '#/graphql/readers/recipeReaders.generated';

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
    const held = client.cache.readFragment<RecipeReadersFragment>({
      id: client.cache.identify(entity),
      fragment: RecipeReadersFragmentDoc,
      returnPartialData: true,
      optimistic: true,
    });
    const patch = {
      status: submitted ? RecipeStatus.PendingReview : RecipeStatus.Draft,
      isPublished: false,
    };
    const previous = snapshotFields(held, patch);
    writeEntityFields(client.cache, entity, patch);
    const revert = () => writeEntityFields(client.cache, entity, previous);

    const status = submitted ? RecipeStatus.Published : RecipeStatus.Draft;
    const settled = await settleMutation(
      () =>
        chainVersionedWrite(client.cache, entity, version =>
          mutate({
            variables: {
              input: { id: recipeId, status, version },
              ingredientsFirst: RECIPE_INGREDIENTS_PAGE_SIZE,
            },
          }),
        ),
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
