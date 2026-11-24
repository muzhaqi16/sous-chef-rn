import { useState } from 'react';
import type { MealType } from '#/graphql/generated/schemaTypes';
import type { MealPlanSheet } from '#features/mealPlan/components/MealPlanSheets';
import type { PlannedCook } from '#features/mealPlan/components/PlannedMealCook';
import { useMealPlanItemActions } from '#features/mealPlan/hooks/useMealPlanItemActions';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { ActiveSheet } from '#hooks/ui/useActiveSheet';
import { toDateKey } from '#/utils/dateUtils';
import type { ActiveMealPlan } from './useActiveMealPlan';

interface UseMealPlanItemHandlersOptions {
  plan: ActiveMealPlan;
  selectedDate: Date;
  sheets: ActiveSheet<MealPlanSheet>;
}

/** What a meal on the plan does when completed, cooked, added or opened. */
export function useMealPlanItemHandlers({
  plan: { activePlanId, itemDetails },
  selectedDate,
  sheets,
}: UseMealPlanItemHandlersOptions) {
  const { toRecipeDetail } = useAppNavigation();
  const { createItem, toggleCompleted, deleteItem } =
    useMealPlanItemActions(activePlanId);
  // The meal being cooked, kept once its sheet closes: a review follows it.
  const [pendingCook, setPendingCook] = useState<PlannedCook | null>(null);

  const toggle = (id: string, isCompleted: boolean, hasRecipe: boolean) => {
    const item = itemDetails.find(i => i.id === id);
    if (!item) return;

    // A recipe meal is cooked as it is completed, once: a meal a cook already
    // completed is checked again with nothing more cooked or deducted.
    if (!isCompleted && hasRecipe && item.recipe && !item.cookingLogId) {
      setPendingCook({
        id: item.id,
        version: item.version,
        recipeId: item.recipe.id,
        recipeName: item.recipe.name,
        defaultServings: item.servings ?? item.recipe.servings,
      });
      sheets.open({ type: 'cook' });
      return;
    }

    // Unchecking, a custom meal, or a meal already cooked
    void toggleCompleted(id);
  };

  // Without the reviewed cook, completing the meal lets the API deduct its
  // recipe's ingredients when deductFromPantry is set.
  const markCooked = (input: {
    servings: number;
    deductFromPantry: boolean;
    notes?: string;
  }) => {
    if (!pendingCook) return;
    void toggleCompleted(pendingCook.id, {
      deductFromPantry: input.deductFromPantry,
      servings: input.servings,
      notes: input.notes,
    });
    setPendingCook(null);
  };

  const add = async (
    meal: { recipeId: string } | { customMealName: string },
    mealType: MealType,
  ) => {
    if (!activePlanId) return;
    const result = await createItem({
      mealPlanId: activePlanId,
      meal,
      mealType,
      date: toDateKey(selectedDate),
    });
    if (result) sheets.close('addMeal');
  };

  return {
    pendingCook,
    toggle,
    markCooked,
    remove: (id: string) => {
      void deleteItem(id);
    },
    addRecipe: (recipeId: string, mealType: MealType) =>
      add({ recipeId }, mealType),
    addCustomMeal: (name: string, mealType: MealType) =>
      add({ customMealName: name }, mealType),
    open: (id: string) => {
      const recipeId = itemDetails.find(i => i.id === id)?.recipe?.id;
      if (recipeId) toRecipeDetail({ recipeId });
    },
  };
}

export type MealPlanItemHandlers = ReturnType<typeof useMealPlanItemHandlers>;
