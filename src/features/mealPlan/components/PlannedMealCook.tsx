import React from 'react';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { MarkCookedModal } from '#features/recipes/ui/MarkCookedModal';
import { RecipeCookFlow } from '#features/recipes/ui/RecipeCookFlow';
import { useRecipeCookingActions } from '#features/recipes/hooks/useRecipeCookingActions';

/** The planned meal a cook from the plan completes, at its current version. */
export interface PlannedCook {
  id: string;
  version: number;
  recipeId: string;
  recipeName: string;
  defaultServings: number;
}

interface PlannedMealCookProps {
  /** Kept after the sheet closes: the review that follows still cooks it. */
  meal: PlannedCook | null;
  visible: boolean;
  onClose: () => void;
  /** Completes the meal and lets the server deduct, as the plan did before. */
  onComplete: (input: {
    servings: number;
    deductFromPantry: boolean;
    notes?: string;
  }) => void;
  /** Shows the plan as it now stands after another change to the meal. */
  onMealChanged: () => void;
}

/**
 * Cooking a planned recipe meal. With `pantryTrackingFoundation`, it is the
 * recipe's own reviewed cook, completing the meal in the same write; off, the
 * meal's completion deducts as it always has.
 */
export const PlannedMealCook: React.FC<PlannedMealCookProps> = ({
  meal,
  visible,
  onClose,
  onComplete,
  onMealChanged,
}) => {
  const reviewed = useFeatureFlag('pantryTrackingFoundation');
  if (reviewed) {
    return (
      <ReviewedMealCook
        meal={meal}
        visible={visible}
        onClose={onClose}
        onMealChanged={onMealChanged}
      />
    );
  }
  return (
    <MarkCookedModal
      visible={visible}
      recipeName={meal?.recipeName ?? ''}
      defaultServings={meal?.defaultServings ?? 1}
      wholeServings
      onClose={onClose}
      onConfirm={onComplete}
    />
  );
};

const ReviewedMealCook: React.FC<
  Pick<PlannedMealCookProps, 'meal' | 'visible' | 'onClose' | 'onMealChanged'>
> = ({ meal, visible, onClose, onMealChanged }) => {
  const cooking = useRecipeCookingActions({
    recipeId: meal?.recipeId,
    plannedMeal: meal ? { id: meal.id, version: meal.version } : null,
    onMealChanged,
  });
  return (
    <RecipeCookFlow
      visible={visible}
      onClose={onClose}
      cooking={cooking}
      recipeName={meal?.recipeName ?? ''}
      defaultServings={meal?.defaultServings ?? 1}
    />
  );
};
