import React from 'react';
import { MarkCookedModal } from '#features/recipes/ui/MarkCookedModal';
import { IngredientMatchingSheet } from '#features/recipes/components/modals/IngredientMatchingSheet';
import type { useRecipeCookingActions } from '#features/recipes/hooks/useRecipeCookingActions';

type RecipeCooking = Pick<
  ReturnType<typeof useRecipeCookingActions>,
  | 'handleMarkAsCooked'
  | 'handleSkipReview'
  | 'handleConfirmReview'
  | 'handleRecordWithoutDeducting'
  | 'ingredientMatching'
>;

interface RecipeCookFlowProps {
  /** The cook sheet; the review opens after it, as the cook asks. */
  visible: boolean;
  onClose: () => void;
  cooking: RecipeCooking;
  recipeName: string;
  defaultServings: number;
}

/**
 * Cooking a recipe, wherever it starts: servings and deduction first, then
 * each draw reviewed stack by stack. A recipe's page and a planned meal open
 * the same flow over `useRecipeCookingActions`, so they propose the same draws.
 */
export const RecipeCookFlow: React.FC<RecipeCookFlowProps> = ({
  visible,
  onClose,
  cooking: {
    handleMarkAsCooked,
    handleSkipReview,
    handleConfirmReview,
    handleRecordWithoutDeducting,
    ingredientMatching,
  },
  recipeName,
  defaultServings,
}) => (
  <>
    <MarkCookedModal
      visible={visible}
      recipeName={recipeName}
      defaultServings={defaultServings}
      onClose={onClose}
      onConfirm={handleMarkAsCooked}
      hasPantry={ingredientMatching.hasPantry}
    />
    <IngredientMatchingSheet
      visible={ingredientMatching.isSheetVisible}
      editableMatches={ingredientMatching.editableMatches}
      matchSummary={ingredientMatching.matchSummary}
      onUpdate={ingredientMatching.updateMatch}
      onConfirm={handleConfirmReview}
      onSkip={handleSkipReview}
      onRecordOnly={handleRecordWithoutDeducting}
      onClose={ingredientMatching.closeSheet}
      confirmLoading={ingredientMatching.confirmLoading}
    />
  </>
);
