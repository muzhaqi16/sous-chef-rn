import { useState } from 'react';
import type { MealType } from '#/graphql/generated/schemaTypes';
import { AddToMealPlanSheet } from '#features/mealPlan/components/AddToMealPlanSheet/AddToMealPlanSheet';

interface Options {
  recipeId: string;
  initialMealType?: MealType;
}

/**
 * Public entry point to the "add this recipe to a meal plan" sheet.
 *
 * The sheet itself reads mealPlan's own mutation and calendar hooks, so it is
 * feature-private. Another feature that needs it takes this hook instead —
 * top-level `hooks/` is a feature's public surface, `components/` is not. That
 * keeps the caller ignorant of how the sheet is built, and keeps mealPlan free
 * to change it.
 */
export const useAddToMealPlanSheet = ({
  recipeId,
  initialMealType,
}: Options) => {
  const [visible, setVisible] = useState(false);

  return {
    open: () => setVisible(true),
    close: () => setVisible(false),
    element: (
      <AddToMealPlanSheet
        visible={visible}
        onClose={() => setVisible(false)}
        recipeId={recipeId}
        initialMealType={initialMealType}
      />
    ),
  };
};
