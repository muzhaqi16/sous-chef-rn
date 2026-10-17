import { skipToken, useQuery } from '@apollo/client/react';
import type { CaptureDraftFill } from '#features/recipes/screens/RecipeForm/useRecipeForm';
import { toPastedIngredient } from '#features/recipes/utils/pastedIngredients';
import { useCaptureLink } from '#features/recipes/store/recipeCaptureStore';
import {
  RecipeCaptureDocument,
  type RecipeCaptureQuery,
} from './useRecipeCapture.generated';

type Draft = NonNullable<
  NonNullable<RecipeCaptureQuery['recipeCapture']>['draft']
>;

const toFill = (draft: Draft, link: string | null): CaptureDraftFill => ({
  name: draft.name,
  description: draft.description,
  servings: draft.servings,
  prepTimeMinutes: draft.prepTimeMinutes,
  cookTimeMinutes: draft.cookTimeMinutes,
  imageUrl: draft.imageUrl,
  author: draft.author,
  sourceName: draft.sourceName,
  sourceUrl: link,
  // A line is linked only where the server was confident; the rest keep
  // their line as written for the user to match.
  ingredients: draft.lines.map(toPastedIngredient),
  steps: draft.steps.map(step => step.text),
});

/** What an incomplete capture read, for the form it opens; null until read. */
export function useCaptureDraft(captureId: string | undefined) {
  const { data } = useQuery(
    RecipeCaptureDocument,
    captureId
      ? {
          variables: { id: captureId },
          fetchPolicy: 'cache-first',
          // The draft does not change once read.
          refetchOn: false,
        }
      : skipToken,
  );
  const link = useCaptureLink(captureId);
  const draft = data?.recipeCapture?.draft;
  return { draft: draft ? toFill(draft, link) : null };
}
