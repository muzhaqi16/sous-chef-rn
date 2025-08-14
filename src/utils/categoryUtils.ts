import type {Item} from '#generated';

interface CategoryStats {
  id: string; // Use name as ID for simplicity
  name: string;
  itemCount: number;
}

// Get all categories for a specific item
export function getCategoriesForItem(item: Item): string[] {
  if (!item?.categories) return [];

  return item.categories
    .map(assignment => assignment.category?.name)
    .filter((name): name is string => Boolean(name));
}

// Get primary category for an item
export function getPrimaryCategoryForItem(item: Item): string | null {
  if (!item?.categories) return null;

  const primaryCategory = item.categories.find(
    assignment => assignment.isPrimary,
  );
  if (primaryCategory?.category?.name) {
    return primaryCategory.category.name;
  }

  // Fallback to first category
  const firstCategory = item.categories[0];
  return firstCategory?.category?.name || null;
}

// Filter items by category name
export function getItemsByCategory(
  items: Item[],
  categoryName: string,
): Item[] {
  if (categoryName === 'Uncategorized') {
    return items.filter(item => getCategoriesForItem(item).length === 0);
  }

  return items.filter(item =>
    getCategoriesForItem(item).includes(categoryName),
  );
}

// Get all unique categories with item counts
export function getAllCategories(items: Item[]): CategoryStats[] {
  const categoryMap = new Map<string, number>();

  items.forEach(item => {
    const categories = getCategoriesForItem(item);

    if (categories.length === 0) {
      categoryMap.set(
        'Uncategorized',
        (categoryMap.get('Uncategorized') || 0) + 1,
      );
    } else {
      categories.forEach(categoryName => {
        categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + 1);
      });
    }
  });

  return Array.from(categoryMap.entries())
    .map(([name, itemCount]) => ({
      id: name, // Use name as ID for simplicity
      name,
      itemCount,
    }))
    .sort((a, b) => b.itemCount - a.itemCount); // Sort by item count
}
