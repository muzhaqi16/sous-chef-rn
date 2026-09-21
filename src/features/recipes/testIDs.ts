/**
 * The recipes feature's testIDs: the tab screen, saved and own recipe lists,
 * the recipe form and the detail screen's header actions. No imports: e2e reads
 * this by relative path, outside the aliases.
 */
export const recipesTestIDs = {
  recipesScreen: 'recipes-screen',
  searchInput: 'recipe-main-search-input',
  searchSubmit: 'recipe-main-search-submit',
  filterCountBadge: 'filter-count-badge',
  activeFiltersSummary: 'active-filters-summary',

  myRecipesScreen: 'my-recipes-screen',
  savedRecipesClearFilters: 'saved-recipes-clear-filters',
  /** `FilterTabs` builds each tab's id under this prefix. */
  savedRecipesFilterTabPrefix: 'saved-recipes-filter-tab',
  searchIncompleteNotice: 'recipes-search-incomplete-notice',
  searchIncompleteRetry: 'recipes-search-incomplete-retry',

  recipeFormScreen: 'recipe-form-screen',

  recipeDetail: 'recipe-detail',
  mealPlanButton: 'recipe-mealplan-button',
  editButton: 'recipe-edit-button',
  publishButton: 'recipe-publish-button',
  forkButton: 'recipe-fork-button',
  folderButton: 'recipe-folder-button',
  heartButton: 'recipe-heart-button',
};
