import {useMemo} from 'react';
import {Item} from '#generated';
import {
  getAllCategories,
  getItemsByCategory,
  getCategoriesForItem,
  getPrimaryCategoryForItem,
} from '#/utils/categoryUtils';

export function useCategoryManagement(items: Item[]) {
  // Get all categories with item counts
  const categories = useMemo(() => {
    return getAllCategories(items);
  }, [items]);

  // Helper functions
  const getItemsByCategoryName = (categoryName: string) => {
    return getItemsByCategory(items, categoryName);
  };

  const getCategoriesForItemById = (itemId: string) => {
    const item = items.find(item => item.id === itemId);
    return item ? getCategoriesForItem(item) : [];
  };

  const getPrimaryCategoryForItemById = (itemId: string) => {
    const item = items.find(item => item.id === itemId);
    return item ? getPrimaryCategoryForItem(item) : null;
  };

  return {
    // Data
    categories,
    // Helper functions
    getItemsByCategory: getItemsByCategoryName,
    getCategoriesForItem: getCategoriesForItemById,
    getPrimaryCategoryForItem: getPrimaryCategoryForItemById,

    // Basic stats
    totalCategories: categories.length,
  };
}
