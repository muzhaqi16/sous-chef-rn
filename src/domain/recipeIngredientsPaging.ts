/**
 * A recipe holds at most this many ingredients. It is also the server's largest
 * page, so one read is the whole list.
 */
export const MAX_RECIPE_INGREDIENTS = 100;

/**
 * Sent as a variable: the server's cost rule multiplies a literal `first` into
 * the selection beneath it.
 */
export const RECIPE_INGREDIENTS_PAGE_SIZE = MAX_RECIPE_INGREDIENTS;
