/**
 * The meal plan's testIDs, shared by the app and the e2e page objects. No
 * imports: Detox's Jest reads this by relative path, outside the aliases.
 */
export const mealPlanTestIDs = {
  screen: 'meal-plan-screen',

  createScreen: 'create-meal-plan-screen',
  createNameInput: 'meal-plan-name-input',
  createDescriptionInput: 'meal-plan-description-input',
  createBudgetInput: 'meal-plan-budget-input',

  templateBuilderScreen: 'meal-template-builder-screen',
  templateNameInput: 'template-name-input',
  templateItemNameInput: 'item-name-input',
  templateSubmitItemButton: 'submit-item-button',
  templateRemoveItem: (itemKey: string) => `remove-item-${itemKey}`,
  templateItemRow: (itemKey: string) => `template-item-${itemKey}`,
  templateChooseRecipeButton: 'template-choose-recipe-button',
  templateItemRecipe: 'template-item-recipe',
  templateClearRecipeButton: 'template-clear-recipe-button',

  templatePreviewEditButton: 'template-preview-edit-button',
  templatePreviewDuplicateButton: 'template-preview-duplicate-button',
  templatePreviewDeleteButton: 'template-preview-delete-button',
  templateDuplicateNameInput: 'template-duplicate-name-input',
  templateDuplicateConfirmButton: 'template-duplicate-confirm-button',
};
