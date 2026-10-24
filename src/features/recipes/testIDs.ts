/**
 * The recipes feature's testIDs: the tab screen, saved and own recipe lists,
 * the recipe form and the detail screen's header actions. No imports: e2e reads
 * this by relative path, outside the aliases.
 */
export const recipesTestIDs = {
  recipesScreen: 'recipes-screen',
  searchInput: 'recipe-main-search-input',
  searchModeTab: (mode: string) => `recipe-search-mode-${mode}`,
  ingredientPicker: 'recipe-ingredient-picker',
  activeFiltersSummary: 'active-filters-summary',

  myRecipesScreen: 'my-recipes-screen',
  savedRecipesClearFilters: 'saved-recipes-clear-filters',
  /** `FilterTabs` builds each tab's id under this prefix. */
  savedRecipesFilterTabPrefix: 'saved-recipes-filter-tab',
  searchIncompleteNotice: 'recipes-search-incomplete-notice',
  searchIncompleteRetry: 'recipes-search-incomplete-retry',

  addManually: 'recipes-add-manually',
  addFromLink: 'recipes-add-from-link',
  addFromText: 'recipes-add-from-text',
  addFromPhotos: 'recipes-add-from-photos',
  captureRows: 'recipes-capture-rows',
  captureUrlInput: 'recipes-capture-url',
  captureTextInput: 'recipes-capture-text',
  captureSourceInput: 'recipes-capture-source',
  captureUseText: 'recipes-capture-use-text',
  captureSend: 'recipes-capture-send',
  captureScan: 'recipes-capture-scan',
  captureChoosePhotos: 'recipes-capture-choose-photos',
  captureReview: 'recipes-capture-review',
  captureReviewUnmatched: 'recipes-capture-review-unmatched',
  recipeFormScreen: 'recipe-form-screen',
  pasteIngredientsButton: 'recipe-form-paste-ingredients',
  pasteIngredientsInput: 'recipe-form-paste-ingredients-input',
  pasteIngredientsAdd: 'recipe-form-paste-ingredients-add',

  recipeDetail: 'recipe-detail',
  recipeDetailSkeleton: 'recipe-detail-skeleton',
  mealPlanButton: 'recipe-mealplan-button',
  editButton: 'recipe-edit-button',
  publishButton: 'recipe-publish-button',
  forkButton: 'recipe-fork-button',
  folderButton: 'recipe-folder-button',
  heartButton: 'recipe-heart-button',
  reportButton: 'recipe-report-button',
  reviewReportButton: (reviewId: string) => `review-report-${reviewId}`,
  /** The recipe page's household dietary summary, and its offline note. */
  householdSummary: 'recipe-household-summary',
  householdUnchecked: 'recipe-household-unchecked',
  /** What can stand in for an ingredient, and one swap in it. */
  substitutesSheet: 'recipe-substitutes-sheet',
  substituteOption: (substituteId: string) =>
    `recipe-substitute-${substituteId}`,
  /** A swap offered for a missing ingredient in the cook review. */
  cookSubstitute: (substituteId: string) => `cook-substitute-${substituteId}`,
};
