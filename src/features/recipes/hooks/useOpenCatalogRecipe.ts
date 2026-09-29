import { useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { OpenCatalogRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import {
  ExternalSource,
  TopLevelErrorCode,
} from '#/graphql/generated/schemaTypes';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload, isAlreadyGone } from '#/utils/errors/mutationPayload';

/** A Spoonacular recipe as a search row shows it, before the API has it. */
export interface CatalogRecipeHint {
  externalId: string;
  name?: string;
  imageUrl?: string;
}

export type OpenedCatalogRecipe =
  | { opened: true; recipeId: string }
  | { opened: false; failure: string };

// The API refuses an image off Spoonacular's own host, and a refused hint fails
// the whole open; the image is only a placeholder, so such a one is left out.
const SPOONACULAR_IMAGE = /^https:\/\/([a-z0-9-]+\.)*spoonacular\.com\//i;

/**
 * The API's own copy of a Spoonacular recipe, found or brought in by id. Never
 * queued: it needs the API, and a recipe with no id cannot be shown.
 */
export function useOpenCatalogRecipe() {
  const { t } = useTranslation();
  const [open] = useMutation(OpenCatalogRecipeDocument);

  const openCatalogRecipe = async (
    hint: CatalogRecipeHint,
  ): Promise<OpenedCatalogRecipe> => {
    const imageUrl =
      hint.imageUrl && SPOONACULAR_IMAGE.test(hint.imageUrl)
        ? hint.imageUrl
        : undefined;
    const settled = await settleMutation(
      () =>
        open({
          variables: {
            input: {
              source: ExternalSource.Spoonacular,
              externalId: hint.externalId,
              name: hint.name,
              imageUrl,
            },
          },
        }),
      {
        document: OpenCatalogRecipeDocument,
        fallback: t('recipes.loadFailed'),
        copy: {
          [TopLevelErrorCode.RateLimitExceeded]: {
            title: t('recipes.rateLimitTitle'),
            body: t('recipes.catalogDailyLimit'),
          },
        },
        present: 'none',
      },
    );

    const payload = appliedPayload(settled.data);
    if (payload) return { opened: true, recipeId: payload.recipe.id };
    // An admin removed it: the same dead end as any recipe that is gone.
    if (isAlreadyGone(settled.data)) {
      return { opened: false, failure: t('recipes.recipeNotFound') };
    }
    return {
      opened: false,
      failure: settled.failure?.body ?? t('recipes.loadFailed'),
    };
  };

  return { openCatalogRecipe };
}
