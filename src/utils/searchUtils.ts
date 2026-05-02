/**
 * Search Utilities - Reusable search predicates for filtering data
 *
 * These utilities provide type-safe search functions that can be
 * used with useSearchableList or any other filtering mechanism.
 */

/**
 * Creates a case-insensitive search predicate for item names
 */
export const createItemNameSearch = <T extends { itemName?: string | null }>(
  item: T,
  query: string,
): boolean => {
  if (!item?.itemName || !query) return false;
  return item.itemName.toLowerCase().includes(query.toLowerCase());
};

/**
 * Creates a case-insensitive search predicate for categories
 */
export const createCategorySearch = <T extends { category?: string | null }>(
  item: T,
  query: string,
): boolean => {
  if (!item?.category || !query) return false;
  return item.category.toLowerCase().includes(query.toLowerCase());
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
