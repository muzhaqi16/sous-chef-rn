/**
 * Search Utilities - Reusable search predicates for filtering data
 *
 * These utilities provide type-safe, composable search functions that can be
 * used with useSearchableList or any other filtering mechanism.
 *
 * Usage:
 * ```typescript
 * const searchPredicate = combineSearchPredicates(
 *   createItemNameSearch,
 *   createCategorySearch
 * );
 *
 * const { filtered } = useSearchableList(items, searchPredicate);
 * ```
 */

/**
 * Creates a case-insensitive search predicate for item names
 */
export const createItemNameSearch = <
  T extends { itemName?: string | null },
>(
  item: T,
  query: string,
): boolean => {
  if (!item?.itemName || !query) return false;
  return item.itemName.toLowerCase().includes(query.toLowerCase());
};

/**
 * Creates a case-insensitive search predicate for nested item.name fields
 * (used in PantryItem where item is a nested object)
 */
export const createNestedItemNameSearch = <
  T extends { item?: { name?: string | null } | null },
>(
  item: T,
  query: string,
): boolean => {
  if (!item?.item?.name || !query) return false;
  return item.item.name.toLowerCase().includes(query.toLowerCase());
};

/**
 * Creates a case-insensitive search predicate for categories
 */
export const createCategorySearch = <
  T extends { category?: string | null },
>(
  item: T,
  query: string,
): boolean => {
  if (!item?.category || !query) return false;
  return item.category.toLowerCase().includes(query.toLowerCase());
};

/**
 * Creates a case-insensitive search predicate for names
 * (generic name field - used for homes, users, etc.)
 */
export const createNameSearch = <T extends { name?: string | null }>(
  item: T,
  query: string,
): boolean => {
  if (!item?.name || !query) return false;
  return item.name.toLowerCase().includes(query.toLowerCase());
};

/**
 * Creates a case-insensitive search predicate for descriptions
 */
export const createDescriptionSearch = <
  T extends { description?: string | null },
>(
  item: T,
  query: string,
): boolean => {
  if (!item?.description || !query) return false;
  return item.description.toLowerCase().includes(query.toLowerCase());
};

/**
 * Creates a case-insensitive search predicate for notes fields
 */
export const createNotesSearch = <T extends { notes?: string | null }>(
  item: T,
  query: string,
): boolean => {
  if (!item?.notes || !query) return false;
  return item.notes.toLowerCase().includes(query.toLowerCase());
};

/**
 * Creates a case-insensitive search predicate for brands
 */
export const createBrandSearch = <T extends { brand?: string | null }>(
  item: T,
  query: string,
): boolean => {
  if (!item?.brand || !query) return false;
  return item.brand.toLowerCase().includes(query.toLowerCase());
};

/**
 * Creates a case-insensitive search predicate for tags arrays
 */
export const createTagsSearch = <T extends { tags?: string[] | null }>(
  item: T,
  query: string,
): boolean => {
  if (!item?.tags || !Array.isArray(item.tags) || !query) return false;
  const lowerQuery = query.toLowerCase();
  return item.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
};

/**
 * Combines multiple search predicates with OR logic
 * Returns true if ANY predicate matches
 *
 * @example
 * ```typescript
 * // Search in both item name and category
 * const searchFn = combineSearchPredicates(
 *   createItemNameSearch,
 *   createCategorySearch
 * );
 * ```
 */
export const combineSearchPredicates =
  <T>(...predicates: Array<(item: T, query: string) => boolean>) =>
  (item: T, query: string): boolean => {
    if (!query) return true; // Empty query matches all
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return true;

    return predicates.some(predicate => predicate(item, trimmedQuery));
  };

/**
 * Combines multiple search predicates with AND logic
 * Returns true only if ALL predicates match
 *
 * @example
 * ```typescript
 * // Search must match both item name AND category
 * const searchFn = combineSearchPredicatesAnd(
 *   createItemNameSearch,
 *   createCategorySearch
 * );
 * ```
 */
export const combineSearchPredicatesAnd =
  <T>(...predicates: Array<(item: T, query: string) => boolean>) =>
  (item: T, query: string): boolean => {
    if (!query) return true; // Empty query matches all
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return true;

    return predicates.every(predicate => predicate(item, trimmedQuery));
  };

/**
 * Specialized search predicate for shopping list items
 * Searches in: itemName, category
 */
export const shoppingListItemSearch = <
  T extends { itemName?: string | null; category?: string | null },
>(
  item: T,
  query: string,
): boolean => {
  if (!query) return true;
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return true;

  return (
    createItemNameSearch(item, trimmedQuery) ||
    createCategorySearch(item, trimmedQuery)
  );
};

/**
 * Specialized search predicate for pantry items
 * Searches in: itemName, nested item.name
 */
export const pantryItemSearch = <
  T extends {
    itemName?: string | null;
  },
>(
  item: T,
  query: string,
): boolean => {
  if (!query) return true;
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return true;

  return createItemNameSearch(item, trimmedQuery);
};

/**
 * Specialized search predicate for recipes
 * Searches in: name, description
 */
export const recipeSearch = <
  T extends { name?: string | null; description?: string | null },
>(
  item: T,
  query: string,
): boolean => {
  if (!query) return true;
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return true;

  return (
    createNameSearch(item, trimmedQuery) ||
    createDescriptionSearch(item, trimmedQuery)
  );
};

/**
 * Specialized search predicate for homes
 * Searches in: name
 */
export const homeSearch = <T extends { name?: string | null }>(
  item: T,
  query: string,
): boolean => {
  return createNameSearch(item, query);
};
