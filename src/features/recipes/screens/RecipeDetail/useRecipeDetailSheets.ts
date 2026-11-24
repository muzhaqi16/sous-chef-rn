import { useState } from 'react';
import type { ReportTarget } from '#features/profile/ui/ReportContentSheet';
import type { DisplayIngredient } from '#features/recipes/hooks/useRecipeData';

// One sheet at a time, holding what it shows. The list picker and the cook
// flow are opened by the flows that own them, inside `useRecipeDetail`.
export type RecipeSheet =
  | { type: 'save' }
  | { type: 'manage' }
  | { type: 'report'; target: ReportTarget }
  | { type: 'ingredient'; ingredient: DisplayIngredient };

export function useRecipeDetailSheets() {
  const [active, setActive] = useState<RecipeSheet | null>(null);
  return {
    active,
    open: (sheet: RecipeSheet) => setActive(sheet),
    close: () => setActive(null),
  };
}

export type RecipeSheetsState = ReturnType<typeof useRecipeDetailSheets>;
