/**
 * The server's largest page. A recipe's ingredients are read at it, so anything
 * up to a hundred is one request; a recipe may hold two hundred, and its detail
 * follows the cursor. Sent as a variable: the server's cost rule multiplies a
 * literal `first` into the selection beneath it.
 */
export const RECIPE_INGREDIENTS_PAGE_SIZE = 100;
